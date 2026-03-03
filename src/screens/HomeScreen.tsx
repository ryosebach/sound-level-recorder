import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { useRecorder } from "@/hooks/useRecorder";
import { formatDuration } from "@/utils/formatDuration";
import { getSplitIntervalMs } from "@/utils/settingsStore";
import { getRecentDecibels } from "@/utils/decibelBuffer";
import { downsample } from "@/utils/csvParser";
import type { DecibelPoint } from "@/utils/csvParser";
import LiveDbGraph from "@/components/LiveDbGraph";
import colors from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

const LIVE_WINDOW_MS = 60_000; // 1 minute
const GRAPH_HEIGHT = 160;

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [splitIntervalMs, setSplitIntervalMs] = useState<number | null>(
    getSplitIntervalMs
  );

  useFocusEffect(
    useCallback(() => {
      setSplitIntervalMs(getSplitIntervalMs());
    }, [])
  );

  const {
    status,
    dbSpl,
    isRecording,
    totalDurationMillis,
    savedFiles,
    start,
    stop,
  } = useRecorder(splitIntervalMs);

  const [livePoints, setLivePoints] = useState<DecibelPoint[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  // Guard against overlapping async polls
  const pollingInFlightRef = useRef(false);

  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
      return;
    }

    const graphWidth = screenWidth - 48; // paddingHorizontal 24 * 2
    const maxPoints = Math.floor(graphWidth / 2);

    const poll = async () => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const rows = await getRecentDecibels(LIVE_WINDOW_MS);
        const points: DecibelPoint[] = rows.map((r) => ({
          timestamp: r.ts,
          offsetMs: r.offset_ms,
          dbSpl: Math.max(0, r.db + 100),
        }));
        setLivePoints(downsample(points, maxPoints));
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const startGraphPolling = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      poll();
      timerRef.current = setInterval(poll, 2000);
    };

    // Start polling initially
    startGraphPolling();

    // Stop polling in background, restart on foreground resume
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        startGraphPolling();
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = undefined;
        }
      }
    });

    return () => {
      subscription.remove();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [isRecording, screenWidth]);

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.statusLabel,
          isRecording ? styles.statusRecording : styles.statusIdle,
        ]}
      >
        {isRecording ? "● 録音中" : "■ 停止中"}
      </Text>

      {status === "permission_denied" && (
        <Text style={styles.warning}>
          マイクの権限が必要です。設定から許可してください。
        </Text>
      )}

      <View style={styles.meterContainer}>
        <Text style={styles.dbValue}>{dbSpl.toFixed(1)} dB</Text>
        <Text style={styles.dbLabel}>approx. SPL</Text>
        <LiveDbGraph
          points={livePoints}
          windowMs={LIVE_WINDOW_MS}
          viewportWidth={screenWidth - 48}
          height={GRAPH_HEIGHT}
        />
      </View>

      <Text style={styles.duration}>
        {formatDuration(totalDurationMillis)}
        {savedFiles.length > 0
          ? ` (${savedFiles.length} file${savedFiles.length !== 1 ? "s" : ""})`
          : ""}
      </Text>

      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonStop]}
        onPress={isRecording ? stop : start}
      >
        <Text style={styles.buttonText}>
          {isRecording ? "停止" : "録音開始"}
        </Text>
      </TouchableOpacity>

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
    marginBottom: 24,
  },
  buttonStop: {
    backgroundColor: colors.accentRed,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: "bold",
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
  statusLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  statusRecording: {
    color: colors.accentRed,
  },
  statusIdle: {
    color: colors.textSecondary,
  },
});
