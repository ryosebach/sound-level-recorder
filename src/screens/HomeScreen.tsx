import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRecorder } from "@/hooks/useRecorder";
import { formatDuration } from "@/utils/formatDuration";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function normalizeDbSpl(dbSpl: number): number {
  return Math.max(0, Math.min(1, dbSpl / 130));
}

export default function HomeScreen({ navigation }: Props) {
  const {
    status,
    dbSpl,
    isRecording,
    totalDurationMillis,
    savedFiles,
    start,
    stop,
  } = useRecorder();

  const appState = useRef(AppState.currentState);
  const [appStateLabel, setAppStateLabel] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
      setAppStateLabel(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  const barWidth = normalizeDbSpl(dbSpl) * 100;

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
        <Text style={styles.dbValue}>{dbSpl.toFixed(1)} dB</Text>
        <Text style={styles.dbLabel}>approx. SPL</Text>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${barWidth}%` }]} />
        </View>
      </View>

      <Text style={styles.duration}>{formatDuration(totalDurationMillis)}</Text>

      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonStop]}
        onPress={isRecording ? stop : start}
      >
        <Text style={styles.buttonText}>
          {isRecording ? "停止" : "録音開始"}
        </Text>
      </TouchableOpacity>

      {savedFiles.length > 0 && (
        <Text style={styles.uri}>
          {savedFiles.length} file{savedFiles.length !== 1 ? "s" : ""} saved
        </Text>
      )}

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.navigate("Recordings")}
      >
        <Text style={styles.navButtonText}>ファイル一覧</Text>
      </TouchableOpacity>

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
    marginBottom: 4,
  },
  dbLabel: {
    fontSize: 12,
    color: "#999",
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
    marginBottom: 16,
  },
  appState: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
  },
  navButton: {
    backgroundColor: "#805ad5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  navButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
