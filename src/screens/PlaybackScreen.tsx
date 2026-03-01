import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { usePlaybackData } from "@/hooks/usePlaybackData";
import { formatDuration } from "@/utils/formatDuration";
import DbGraph from "@/components/DbGraph";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Playback">;

export default function PlaybackScreen({ route }: Props) {
  const { uri, name } = route.params;

  const player = useAudioPlayer({ uri }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  const [viewportWidth, setViewportWidth] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const durationMs = status.duration * 1000;
  const currentTimeMs = status.currentTime * 1000;

  // Downsample to half of total graph width (1min = viewportWidth)
  const durationMin = Math.max(durationMs / 60000, 1);
  const totalGraphWidth = viewportWidth * durationMin;
  const maxPoints = Math.max(300, Math.round(totalGraphWidth / 2));

  const playbackData = usePlaybackData(uri, maxPoints);

  const handlePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, status.playing]);

  const handleSeek = useCallback(
    (ms: number) => {
      player.seekTo(ms / 1000);
    },
    [player]
  );

  const handleSlidingStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(status.currentTime);
  }, [status.currentTime]);

  const handleSliderChange = useCallback(
    (value: number) => {
      if (isSeeking) {
        setSeekValue(value);
      }
    },
    [isSeeking]
  );

  const handleSlidingComplete = useCallback(
    (value: number) => {
      player.seekTo(value);
      setIsSeeking(false);
    },
    [player]
  );

  const displayTime = isSeeking ? seekValue * 1000 : currentTimeMs;

  return (
    <View style={styles.container}>
      <Text style={styles.fileName} numberOfLines={1}>
        {name}
      </Text>

      <View
        style={styles.graphContainer}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      >
        {playbackData.status === "loading" && (
          <View style={styles.graphPlaceholder}>
            <Text style={styles.placeholderText}>読み込み中...</Text>
          </View>
        )}
        {playbackData.status === "error" && (
          <View style={styles.graphPlaceholder}>
            <Text style={styles.errorText}>
              CSVデータが見つかりません
            </Text>
          </View>
        )}
        {playbackData.status === "ready" &&
          viewportWidth > 0 &&
          durationMs > 0 && (
            <DbGraph
              points={playbackData.points}
              durationMs={durationMs}
              currentTimeMs={currentTimeMs}
              viewportWidth={viewportWidth}
              height={250}
              onSeek={handleSeek}
            />
          )}
      </View>

      <View style={styles.controls}>
        <View style={styles.timeRow}>
          <Text style={styles.time}>
            {formatDuration(displayTime)}
          </Text>
          <Text style={styles.time}>
            {formatDuration(durationMs)}
          </Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={status.duration || 1}
          value={isSeeking ? seekValue : status.currentTime}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor="#3182ce"
          maximumTrackTintColor="#e2e8f0"
          thumbTintColor="#3182ce"
        />

        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
        >
          <Text style={styles.playButtonText}>
            {status.playing ? "⏸ 一時停止" : "▶ 再生"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2d3748",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  graphContainer: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: "#f7fafc",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
  },
  graphPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 14,
    color: "#a0aec0",
  },
  errorText: {
    fontSize: 14,
    color: "#e53e3e",
  },
  controls: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    color: "#4a5568",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  playButton: {
    alignSelf: "center",
    backgroundColor: "#3182ce",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
