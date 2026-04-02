import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Slider from "@react-native-community/slider";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { usePlaybackData } from "@/hooks/usePlaybackData";
import { formatDuration } from "@/utils/formatDuration";
import DbGraph from "@/components/DbGraph";
import { readMeta, writeMeta, getSegmentPath, deleteSegment } from "@/utils/fileManager";
import { triggerMetaUpload } from "@/services/uploadManager";
import colors from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Playback">;

const PlaybackScreen = ({ route, navigation }: Props) => {
  const { uri, name, sessionId, segmentId } = route.params;

  const player = useAudioPlayer({ uri }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  const [viewportWidth, setViewportWidth] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const [meta, setMeta] = useState(() => readMeta(sessionId, segmentId));
  const [commentDraft, setCommentDraft] = useState(meta.comment);

  const handleToggleFavorite = useCallback(() => {
    const updated = writeMeta(sessionId, segmentId, { favorite: !meta.favorite });
    setMeta(updated);
    triggerMetaUpload(getSegmentPath(sessionId, segmentId));
  }, [sessionId, segmentId, meta.favorite]);

  const handleCommentBlur = useCallback(() => {
    if (commentDraft === meta.comment) return;
    const updated = writeMeta(sessionId, segmentId, { comment: commentDraft });
    setMeta(updated);
    triggerMetaUpload(getSegmentPath(sessionId, segmentId));
  }, [sessionId, segmentId, commentDraft, meta.comment]);

  const handleDelete = useCallback(() => {
    Alert.alert("セグメントを削除", "このセグメントを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          player.pause();
          deleteSegment(sessionId, segmentId);
          navigation.goBack();
        },
      },
    ]);
  }, [sessionId, segmentId, player, navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.headerDeleteText}>削除</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleDelete]);

  const durationMs = status.duration * 1000;
  const currentTimeMs = status.currentTime * 1000;

  // Downsample to half of total graph width (1min = viewportWidth)
  const durationMin = Math.max(durationMs / 60000, 1);
  const MAX_GRAPH_WIDTH = 10_000;
  const totalGraphWidth = Math.min(viewportWidth * durationMin, MAX_GRAPH_WIDTH);
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
    [player],
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
    [isSeeking],
  );

  const handleSlidingComplete = useCallback(
    (value: number) => {
      player.seekTo(value);
      setIsSeeking(false);
    },
    [player],
  );

  const displayTime = isSeeking ? seekValue * 1000 : currentTimeMs;

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
    >
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
            <Text style={styles.errorText}>CSVデータが見つかりません</Text>
          </View>
        )}
        {playbackData.status === "ready" && viewportWidth > 0 && durationMs > 0 && (
          <DbGraph
            points={playbackData.points}
            durationMs={durationMs}
            currentTimeMs={currentTimeMs}
            viewportWidth={viewportWidth}
            height={250}
            startTimestamp={playbackData.startTimestamp}
            onSeek={handleSeek}
          />
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatDuration(displayTime)}</Text>
          <Text style={styles.time}>{formatDuration(durationMs)}</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={status.duration || 1}
          value={isSeeking ? seekValue : status.currentTime}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={colors.accentBlue}
          maximumTrackTintColor={colors.borderStrong}
          thumbTintColor={colors.accentBlue}
        />

        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Text style={styles.playButtonText}>
            {status.playing ? "\u23F8 一時停止" : "\u25B6 再生"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metaSection}>
        <View style={styles.favoriteRow}>
          <Text style={styles.metaLabel}>お気に入り</Text>
          <TouchableOpacity onPress={handleToggleFavorite}>
            <Text style={[styles.favoriteIcon, meta.favorite && styles.favoriteActive]}>
              {meta.favorite ? "\u2605" : "\u2606"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.metaLabel}>コメント</Text>
          <TextInput
            style={styles.commentInput}
            value={commentDraft}
            onChangeText={setCommentDraft}
            onBlur={handleCommentBlur}
            placeholder="コメントを入力..."
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
};

export default PlaybackScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  graphContainer: {
    height: 250,
    marginHorizontal: 16,
    backgroundColor: colors.bgSecondary,
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
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 14,
    color: colors.accentRed,
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
    color: colors.textSecondary,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  playButton: {
    alignSelf: "center",
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  playButtonText: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: "bold",
  },
  metaSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  favoriteIcon: {
    fontSize: 28,
    color: colors.textMuted,
  },
  favoriteActive: {
    color: colors.accentOrange,
  },
  commentSection: {
    paddingTop: 12,
    gap: 8,
  },
  commentInput: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 8,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  headerDeleteText: {
    color: colors.accentRed,
    fontSize: 16,
    fontWeight: "bold",
  },
});
