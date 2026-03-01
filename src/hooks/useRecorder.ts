import { useCallback, useEffect, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

const POLLING_INTERVAL_MS = 100;

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

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");

  // Set audio mode early so the native recorder inherits allowsBackgroundRecording
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      allowsBackgroundRecording: true,
    });
  }, []);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, POLLING_INTERVAL_MS);

  const start = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setStatus("permission_denied");
      return;
    }

    await requestNotificationPermission();

    await recorder.prepareToRecordAsync();
    recorder.record();
    setStatus("recording");
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    setStatus("idle");
  }, [recorder]);

  const meteringDbfs = state.metering ?? -160;
  const dbSpl = Math.max(0, meteringDbfs + DBFS_TO_SPL_OFFSET);

  return {
    status,
    metering: meteringDbfs,
    dbSpl,
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
    uri: recorder.uri,
    start,
    stop,
  };
}
