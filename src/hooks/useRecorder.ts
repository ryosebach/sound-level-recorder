import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, PermissionsAndroid } from "react-native";
import {
  IOSOutputFormat,
  AudioQuality,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import type { RecorderState } from "expo-audio";
import { requireNativeModule } from "expo-modules-core";
import {
  moveRecording,
  getRecordingUri,
  writeDecibelCsv,
} from "@/utils/fileManager";
import {
  insertDecibelBatch,
  exportDecibelCsv,
  deleteDecibelRows,
  clearAllDecibelRows,
} from "@/utils/decibelBuffer";
import {
  startBackgroundTask,
  stopBackgroundTask,
} from "@/utils/backgroundTask";

const AudioModule = requireNativeModule("ExpoAudio");

const RECORDING_OPTIONS = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: {
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

const POLLING_INTERVAL_MS = 100;
const FLUSH_INTERVAL_MS = 2000;

// Approximate offset to convert dBFS to dB SPL.
// This is a rough estimate; accurate conversion requires per-device calibration.
const DBFS_TO_SPL_OFFSET = 100;

export type RecorderStatus = "idle" | "recording" | "permission_denied";

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS === "android" && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  }
}

function createRecorder() {
  return new AudioModule.AudioRecorder(RECORDING_OPTIONS);
}

export function useRecorder(splitIntervalMs: number | null = 21_600_000) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [metering, setMetering] = useState<number | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [completedDurationMillis, setCompletedDurationMillis] = useState(0);
  // Wall-clock elapsed time for the current segment, updated by polling / resume
  const [segmentElapsedMillis, setSegmentElapsedMillis] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recorderRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSplittingRef = useRef(false);
  // Track foreground/background to skip setState in background
  const appActiveRef = useRef(AppState.currentState === "active");
  // Wall-clock timestamp when the current segment started recording
  const segmentStartRef = useRef<number>(0);
  // ISO timestamp when the current segment started (for SQLite range queries)
  const segmentStartIsoRef = useRef<string>("");
  // Memory buffer for batched SQLite inserts
  const pendingInserts = useRef<{ ts: string; offsetMs: number; db: number }[]>(
    []
  );
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs for background-safe split: polling callback can access latest values
  const splitIntervalMsRef = useRef(splitIntervalMs);
  splitIntervalMsRef.current = splitIntervalMs;
  const splitRecordingRef = useRef<() => void>(() => {});

  // Set audio mode early so the native recorder inherits allowsBackgroundRecording
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: true,
      allowsBackgroundRecording: true,
    });
  }, []);

  const flushPending = useCallback(() => {
    if (pendingInserts.current.length > 0) {
      insertDecibelBatch(pendingInserts.current);
      pendingInserts.current = [];
    }
  }, []);

  const stopFlushing = useCallback(() => {
    if (flushRef.current != null) {
      clearInterval(flushRef.current);
      flushRef.current = null;
    }
  }, []);

  const startFlushing = useCallback(() => {
    stopFlushing();
    flushRef.current = setInterval(flushPending, FLUSH_INTERVAL_MS);
  }, [stopFlushing, flushPending]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current != null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recorder: any) => {
      stopPolling();
      pollingRef.current = setInterval(() => {
        try {
          const now = Date.now();
          const newState: RecorderState = recorder.getStatus();
          const elapsed = now - segmentStartRef.current;
          // Only update React state when in foreground to avoid
          // queuing thousands of bridge messages during background
          if (appActiveRef.current) {
            setMetering(newState.metering);
            setIsRecording(newState.isRecording);
            setSegmentElapsedMillis(elapsed);
          }
          if (newState.metering != null) {
            pendingInserts.current.push({
              ts: new Date(now).toISOString(),
              offsetMs: elapsed,
              db: newState.metering,
            });
          }
          // Split check — runs in background too (via react-native-background-actions)
          const interval = splitIntervalMsRef.current;
          if (
            !isSplittingRef.current &&
            interval !== null &&
            elapsed >= interval
          ) {
            splitRecordingRef.current();
          }
        } catch {
          // Polling may fail if recorder was released
        }
      }, POLLING_INTERVAL_MS);
    },
    [stopPolling]
  );

  const splitRecording = useCallback(async () => {
    if (isSplittingRef.current) return;
    isSplittingRef.current = true;

    const oldRecorder = recorderRef.current;
    if (!oldRecorder) {
      isSplittingRef.current = false;
      return;
    }

    stopPolling();
    stopFlushing();
    flushPending();

    const segmentDuration = Date.now() - segmentStartRef.current;
    const fromIso = segmentStartIsoRef.current;
    const toIso = new Date().toISOString();

    await oldRecorder.stop();
    const oldUri = oldRecorder.uri;

    // Start new recorder immediately
    const newRecorder = createRecorder();
    recorderRef.current = newRecorder;
    await newRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
    newRecorder.record();
    segmentStartRef.current = Date.now();
    segmentStartIsoRef.current = new Date().toISOString();
    startPolling(newRecorder);
    startFlushing();

    // Move the old file and export CSV — runs async after recording resumes
    if (oldUri) {
      const audioFilename = moveRecording(oldUri);
      setSavedFiles((prev) => [...prev, getRecordingUri(audioFilename)]);

      // Non-blocking: CSV export + cleanup runs in background
      exportDecibelCsv(fromIso, toIso).then((csvContent) => {
        writeDecibelCsv(csvContent, audioFilename);
        deleteDecibelRows(fromIso, toIso);
      });
    }

    setCompletedDurationMillis((prev) => prev + segmentDuration);
    setSegmentElapsedMillis(0);
    isSplittingRef.current = false;
  }, [stopPolling, startPolling, stopFlushing, startFlushing, flushPending]);
  splitRecordingRef.current = splitRecording;

  // Restart polling and refresh state when returning to foreground.
  // setInterval may stop firing while the app is in the background on iOS;
  // we recreate it on resume so the UI keeps updating.
  useEffect(() => {
    let resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isActive = nextAppState === "active";
      appActiveRef.current = isActive;
      const recorder = recorderRef.current;
      if (isActive && recorder) {
        // Sync latest values into React state on resume
        setSegmentElapsedMillis(Date.now() - segmentStartRef.current);
        try {
          const s: RecorderState = recorder.getStatus();
          setMetering(s.metering);
          setIsRecording(s.isRecording);
        } catch {
          // Recorder may have been released
        }
        // Delay polling restart to let UI render first
        resumeTimeoutId = setTimeout(() => {
          startPolling(recorder);
          startFlushing();
        }, 300);
      }
    });
    return () => {
      if (resumeTimeoutId) clearTimeout(resumeTimeoutId);
      subscription.remove();
    };
  }, [startPolling, startFlushing]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      stopFlushing();
      flushPending();
    };
  }, [stopPolling, stopFlushing, flushPending]);

  const start = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setStatus("permission_denied");
      return;
    }

    await requestNotificationPermission();

    const recorder = createRecorder();
    recorderRef.current = recorder;
    await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
    recorder.record();

    await startBackgroundTask();

    clearAllDecibelRows();
    pendingInserts.current = [];
    segmentStartRef.current = Date.now();
    segmentStartIsoRef.current = new Date().toISOString();
    setSavedFiles([]);
    setCompletedDurationMillis(0);
    setSegmentElapsedMillis(0);
    startPolling(recorder);
    startFlushing();
    setStatus("recording");
  }, [startPolling, startFlushing]);

  const stop = useCallback(async () => {
    stopPolling();
    stopFlushing();
    flushPending();

    const recorder = recorderRef.current;
    if (recorder) {
      const segmentDuration = Date.now() - segmentStartRef.current;
      const fromIso = segmentStartIsoRef.current;
      const toIso = new Date().toISOString();

      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const audioFilename = moveRecording(uri);
        setSavedFiles((prev) => [...prev, getRecordingUri(audioFilename)]);

        const csvContent = await exportDecibelCsv(fromIso, toIso);
        writeDecibelCsv(csvContent, audioFilename);
        await deleteDecibelRows(fromIso, toIso);
      }
      setCompletedDurationMillis((prev) => prev + segmentDuration);
      recorderRef.current = null;
    }

    await stopBackgroundTask();
    setMetering(undefined);
    setIsRecording(false);
    setSegmentElapsedMillis(0);
    setStatus("idle");
  }, [stopPolling, stopFlushing, flushPending]);

  const meteringDbfs = metering ?? -160;
  const dbSpl = Math.max(0, meteringDbfs + DBFS_TO_SPL_OFFSET);
  const totalDurationMillis = completedDurationMillis + segmentElapsedMillis;

  return {
    status,
    metering: meteringDbfs,
    dbSpl,
    isRecording,
    totalDurationMillis,
    savedFiles,
    start,
    stop,
  };
}
