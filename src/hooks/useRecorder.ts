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
  insertDecibel,
  exportDecibelCsv,
  deleteDecibelRows,
  clearAllDecibelRows,
} from "@/utils/decibelBuffer";

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
const SPLIT_INTERVAL_MS = 3_600_000; // 1 hour

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

export function useRecorder() {
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
  // Wall-clock timestamp when the current segment started recording
  const segmentStartRef = useRef<number>(0);
  // ISO timestamp when the current segment started (for SQLite range queries)
  const segmentStartIsoRef = useRef<string>("");

  // Set audio mode early so the native recorder inherits allowsBackgroundRecording
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      allowsBackgroundRecording: true,
    });
  }, []);

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
          setMetering(newState.metering);
          setIsRecording(newState.isRecording);
          setSegmentElapsedMillis(now - segmentStartRef.current);
          if (newState.metering != null) {
            const isoString = new Date(now).toISOString();
            const offsetMs = now - segmentStartRef.current;
            insertDecibel(isoString, offsetMs, newState.metering);
          }
        } catch {
          // Recorder may have been released during split
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

    // Move the old file and export CSV
    if (oldUri) {
      const audioFilename = moveRecording(oldUri);
      setSavedFiles((prev) => [...prev, getRecordingUri(audioFilename)]);

      const csvContent = exportDecibelCsv(fromIso, toIso);
      writeDecibelCsv(csvContent, audioFilename);
      deleteDecibelRows(fromIso, toIso);
    }

    setCompletedDurationMillis((prev) => prev + segmentDuration);
    setSegmentElapsedMillis(0);
    isSplittingRef.current = false;
  }, [stopPolling, startPolling]);

  // Check if split is needed (wall-clock based)
  useEffect(() => {
    if (
      isRecording &&
      !isSplittingRef.current &&
      segmentElapsedMillis >= SPLIT_INTERVAL_MS
    ) {
      splitRecording();
    }
  }, [segmentElapsedMillis, isRecording, splitRecording]);

  // Restart polling and refresh state when returning to foreground.
  // setInterval stops firing while the app is in the background;
  // we recreate it on resume so the UI keeps updating.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const recorder = recorderRef.current;
      if (nextAppState === "active" && recorder) {
        setSegmentElapsedMillis(Date.now() - segmentStartRef.current);
        try {
          const s: RecorderState = recorder.getStatus();
          setMetering(s.metering);
          setIsRecording(s.isRecording);
        } catch {
          // Recorder may have been released
        }
        startPolling(recorder);
      }
    });
    return () => subscription.remove();
  }, [startPolling]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

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

    clearAllDecibelRows();
    segmentStartRef.current = Date.now();
    segmentStartIsoRef.current = new Date().toISOString();
    setSavedFiles([]);
    setCompletedDurationMillis(0);
    setSegmentElapsedMillis(0);
    startPolling(recorder);
    setStatus("recording");
  }, [startPolling]);

  const stop = useCallback(async () => {
    stopPolling();
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

        const csvContent = exportDecibelCsv(fromIso, toIso);
        writeDecibelCsv(csvContent, audioFilename);
        deleteDecibelRows(fromIso, toIso);
      }
      setCompletedDurationMillis((prev) => prev + segmentDuration);
      recorderRef.current = null;
    }
    setMetering(undefined);
    setIsRecording(false);
    setSegmentElapsedMillis(0);
    setStatus("idle");
  }, [stopPolling]);

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
