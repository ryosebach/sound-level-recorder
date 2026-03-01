import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { File } from "expo-file-system/next";
import { StatusBar } from "expo-status-bar";
import { useRecorder } from "@/hooks/useRecorder";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeDb(db: number): number {
  // dB range: -160 ~ 0, normalize to 0 ~ 1
  return Math.max(0, Math.min(1, (db + 160) / 160));
}

export default function App() {
  const { status, metering, isRecording, durationMillis, uri, start, stop } =
    useRecorder();

  const appState = useRef(AppState.currentState);
  const [appStateLabel, setAppStateLabel] = useState(AppState.currentState);

  const [fileSize, setFileSize] = useState<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
      setAppStateLabel(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (uri && !isRecording) {
      const file = new File(uri);
      if (file.exists) {
        const size = file.size ?? 0;
        const kb = (size / 1024).toFixed(1);
        const mb = (size / 1024 / 1024).toFixed(2);
        setFileSize(size > 1024 * 1024 ? `${mb} MB` : `${kb} KB`);
      }
    } else {
      setFileSize(null);
    }
  }, [uri, isRecording]);

  const barWidth = normalizeDb(metering) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recording PoC</Text>

      <Text style={styles.appState}>AppState: {appStateLabel}</Text>

      {status === "permission_denied" && (
        <Text style={styles.warning}>
          マイクの権限が必要です。設定から許可してください。
        </Text>
      )}

      <View style={styles.meterContainer}>
        <Text style={styles.dbValue}>{metering.toFixed(1)} dB</Text>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${barWidth}%` }]} />
        </View>
      </View>

      <Text style={styles.duration}>{formatDuration(durationMillis)}</Text>

      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonStop]}
        onPress={isRecording ? stop : start}
      >
        <Text style={styles.buttonText}>
          {isRecording ? "停止" : "録音開始"}
        </Text>
      </TouchableOpacity>

      {uri && !isRecording && (
        <>
          <Text style={styles.uri}>保存先: {uri}</Text>
          {fileSize && <Text style={styles.uri}>ファイルサイズ: {fileSize}</Text>}
        </>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 32,
  },
  warning: {
    color: "#e53e3e",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  meterContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  dbValue: {
    fontSize: 48,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
    marginBottom: 12,
  },
  barBackground: {
    width: "100%",
    height: 20,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#38a169",
    borderRadius: 10,
  },
  duration: {
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    color: "#666",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#3182ce",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonStop: {
    backgroundColor: "#e53e3e",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  uri: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
  appState: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
  },
});
