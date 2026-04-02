import { useCallback, useState } from "react";
import { Alert, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import {
  listRecordingSessions,
  deleteSegment,
  deleteAllRecordings,
  getSegmentPath,
  type SegmentFile,
} from "@/utils/fileManager";
import colors from "@/theme/colors";
import { uploadManual, syncDriveStatus } from "@/services/uploadManager";
import { getAllUploadStatuses, type FileUploadStatus } from "@/services/uploadQueue";
import { isSignedIn } from "@/services/googleAuth";

type Props = NativeStackScreenProps<RootStackParamList, "Recordings">;

type SectionData = {
  sessionId: string;
  totalSize: number;
  segmentCount: number;
  data: SegmentFile[];
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatSessionTitle = (sessionId: string): string => {
  // "session_2026-03-09_14-30-45" → "2026/03/09 14:30"
  const match = sessionId.match(/^session_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return sessionId;
  return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
};

const formatSegmentTime = (segmentId: string): string => {
  // "segment_2026-03-09_14-30-45" → "14:30:45"
  const match = segmentId.match(/_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return segmentId;
  return `${match[1]}:${match[2]}:${match[3]}`;
};

const UPLOAD_STATUS_LABELS: Record<FileUploadStatus, string> = {
  not_queued: "",
  pending: "待機中",
  uploading: "アップロード中",
  uploaded: "アップロード済",
  failed: "失敗",
};

const UPLOAD_STATUS_COLORS: Record<FileUploadStatus, string> = {
  not_queued: colors.textMuted,
  pending: colors.accentOrange,
  uploading: colors.accentBlue,
  uploaded: colors.accentGreen,
  failed: colors.accentRed,
};

const RecordingsScreen = ({ navigation }: Props) => {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, FileUploadStatus>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadFiles = useCallback(() => {
    const sessions = listRecordingSessions();
    const newSections: SectionData[] = sessions.map((s) => ({
      sessionId: s.sessionId,
      totalSize: s.segments.reduce((sum, seg) => sum + seg.size, 0),
      segmentCount: s.segments.length,
      data: s.segments,
    }));
    setSections(newSections);
    setSelectedKeys(new Set());
    setUploadStatuses(getAllUploadStatuses());
  }, []);

  useFocusEffect(loadFiles);

  const getSegmentKey = (sessionId: string, segmentId: string): string => {
    return getSegmentPath(sessionId, segmentId);
  };

  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedKeys.size === 0) return;
    Alert.alert("選択したセグメントを削除", `${selectedKeys.size} 件のセグメントを削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          for (const key of selectedKeys) {
            const [sessionId, segmentId] = key.split("/");
            deleteSegment(sessionId, segmentId);
          }
          loadFiles();
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    const totalSegments = sections.reduce((sum, s) => sum + s.segmentCount, 0);
    if (totalSegments === 0) return;
    Alert.alert("全件削除", `${totalSegments} 件のセグメントをすべて削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "全件削除",
        style: "destructive",
        onPress: () => {
          deleteAllRecordings();
          loadFiles();
        },
      },
    ]);
  };

  const handleUploadSelected = async () => {
    if (selectedKeys.size === 0) return;
    if (!isSignedIn()) {
      Alert.alert("サインインが必要", "設定画面から Google アカウントにサインインしてください");
      return;
    }
    setIsUploading(true);
    try {
      const segmentPaths = [...selectedKeys];
      await uploadManual(segmentPaths);
      loadFiles();
    } catch (e) {
      Alert.alert("アップロードエラー", e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncStatus = async () => {
    if (!isSignedIn()) {
      Alert.alert("サインインが必要", "設定画面から Google アカウントにサインインしてください");
      return;
    }
    setIsSyncing(true);
    try {
      const resetCount = await syncDriveStatus();
      loadFiles();
      if (resetCount > 0) {
        Alert.alert(
          "同期完了",
          `${resetCount} 件のファイルが Drive 上に見つからないため、ステータスをリセットしました`,
        );
      } else {
        Alert.alert("同期完了", "すべてのファイルが Drive 上に存在しています");
      }
    } catch (e) {
      Alert.alert("同期エラー", e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRowPress = (sessionId: string, item: SegmentFile) => {
    navigation.navigate("Playback", { uri: item.audioUri, name: item.segmentId });
  };

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{formatSessionTitle(section.sessionId)} 開始</Text>
      <Text style={styles.sectionMeta}>
        {section.segmentCount} セグメント / {formatFileSize(section.totalSize)}
      </Text>
    </View>
  );

  const renderItem = ({ item, section }: { item: SegmentFile; section: SectionData }) => {
    const key = getSegmentKey(section.sessionId, item.segmentId);
    const isSelected = selectedKeys.has(key);
    const uploadStatus = uploadStatuses.get(key) ?? "not_queued";
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => handleRowPress(section.sessionId, item)}
      >
        <TouchableOpacity
          style={styles.checkbox}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => toggleSelection(key)}
        >
          {isSelected && <View style={styles.checkboxInner} />}
        </TouchableOpacity>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {formatSegmentTime(item.segmentId)}
          </Text>
          <View style={styles.fileMetaRow}>
            <Text style={styles.fileMeta}>{formatFileSize(item.size)}</Text>
            {uploadStatus !== "not_queued" && (
              <Text style={[styles.uploadStatus, { color: UPLOAD_STATUS_COLORS[uploadStatus] }]}>
                {UPLOAD_STATUS_LABELS[uploadStatus]}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalSegments = sections.reduce((sum, s) => sum + s.segmentCount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarButton, styles.syncButton, isSyncing && styles.buttonDisabled]}
          onPress={handleSyncStatus}
          disabled={isSyncing}
        >
          <Text style={styles.toolbarButtonText}>{isSyncing ? "同期中..." : "Drive 同期"}</Text>
        </TouchableOpacity>
        <View style={styles.toolbarSpacer} />
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            styles.uploadButton,
            (selectedKeys.size === 0 || isUploading) && styles.buttonDisabled,
          ]}
          onPress={handleUploadSelected}
          disabled={selectedKeys.size === 0 || isUploading}
        >
          <Text style={styles.toolbarButtonText}>
            {isUploading ? "アップロード中..." : `アップロード (${selectedKeys.size})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            styles.deleteButton,
            selectedKeys.size === 0 && styles.buttonDisabled,
          ]}
          onPress={handleDeleteSelected}
          disabled={selectedKeys.size === 0}
        >
          <Text style={styles.toolbarButtonText}>削除 ({selectedKeys.size})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            styles.deleteAllButton,
            totalSegments === 0 && styles.buttonDisabled,
          ]}
          onPress={handleDeleteAll}
          disabled={totalSegments === 0}
        >
          <Text style={styles.toolbarButtonText}>全件削除</Text>
        </TouchableOpacity>
      </View>

      {totalSegments === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>録音ファイルがありません</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.segmentId + index}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <View style={styles.listFooter}>
              <View style={styles.footerDot} />
            </View>
          }
        />
      )}
    </View>
  );
};

export default RecordingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  toolbarButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButton: {
    backgroundColor: colors.accentPurple,
  },
  toolbarSpacer: {
    flex: 1,
  },
  uploadButton: {
    backgroundColor: colors.accentBlue,
  },
  deleteButton: {
    backgroundColor: colors.accentRed,
  },
  deleteAllButton: {
    backgroundColor: colors.accentOrange,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  toolbarButtonText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: "bold",
  },
  list: {
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  sectionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingLeft: 32,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowSelected: {
    backgroundColor: colors.highlight,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textMuted,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fileMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  uploadStatus: {
    fontSize: 11,
    fontWeight: "bold",
  },
  listFooter: {
    alignItems: "center",
    paddingVertical: 24,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
