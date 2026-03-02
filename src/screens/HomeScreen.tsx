import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRecorder } from "@/hooks/useRecorder";
import { formatDuration } from "@/utils/formatDuration";
import colors from "@/theme/colors";
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
        <Text style={styles.savedCount}>
          {savedFiles.length} file{savedFiles.length !== 1 ? "s" : ""} saved
        </Text>
      )}

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.navigate("Recordings")}
      >
        <Text style={styles.navButtonText}>ファイル一覧</Text>
      </TouchableOpacity>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 32,
    color: colors.textPrimary,
  },
  warning: {
    color: colors.accentRed,
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
    color: colors.textPrimary,
  },
  dbLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  barBackground: {
    width: "100%",
    height: 20,
    backgroundColor: colors.borderStrong,
    borderRadius: 10,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.accentGreen,
    borderRadius: 10,
  },
  duration: {
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    color: colors.textSecondary,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonStop: {
    backgroundColor: colors.accentRed,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: "bold",
  },
  savedCount: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
    marginBottom: 16,
  },
  appState: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  navButton: {
    backgroundColor: colors.accentPurple,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  navButtonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: "bold",
  },
});
