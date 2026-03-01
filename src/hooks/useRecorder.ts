import { useCallback, useState } from "react";
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

export type RecorderStatus = "idle" | "recording" | "permission_denied";

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, POLLING_INTERVAL_MS);

  const start = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setStatus("permission_denied");
      return;
    }

    await setAudioModeAsync({ playsInSilentMode: true });
    recorder.record();
    setStatus("recording");
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    setStatus("idle");
  }, [recorder]);

  return {
    status,
    metering: state.metering ?? -160,
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
    uri: recorder.uri,
    start,
    stop,
  };
}
