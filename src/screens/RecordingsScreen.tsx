import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import {
  listRecordings,
  deleteRecording,
  deleteAllRecordings,
  type RecordingFile,
} from "@/utils/fileManager";
import colors from "@/theme/colors";
import { uploadManual, syncDriveStatus } from "@/services/uploadManager";
import { getUploadStatusForFile, type FileUploadStatus } from "@/services/uploadQueue";
import { isSignedIn } from "@/services/googleAuth";

type Props = NativeStackScreenProps<RootStackParamList, "Recordings">;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [files, setFiles] = useState<RecordingFile[]>([]);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, FileUploadStatus>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadFiles = useCallback(() => {
    const recordings = listRecordings();
    setFiles(recordings);
    setSelectedUris(new Set());
    const statuses = new Map<string, FileUploadStatus>();
    for (const f of recordings) {
      statuses.set(f.name, getUploadStatusForFile(f.name));
    }
    setUploadStatuses(statuses);
  }, []);

  useFocusEffect(loadFiles);

  const toggleSelection = (uri: string) => {
    setSelectedUris((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedUris.size === 0) return;
    Alert.alert("選択したファイルを削除", `${selectedUris.size} 件のファイルを削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          for (const uri of selectedUris) {
            deleteRecording(uri);
          }
          loadFiles();
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    if (files.length === 0) return;
    Alert.alert("全件削除", `${files.length} 件のファイルをすべて削除しますか？`, [
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
    if (selectedUris.size === 0) return;
    if (!isSignedIn()) {
      Alert.alert("サインインが必要", "設定画面から Google アカウントにサインインしてください");
      return;
    }
    setIsUploading(true);
    try {
      const audioFilenames = files.filter((f) => selectedUris.has(f.uri)).map((f) => f.name);
      await uploadManual(audioFilenames);
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

  const handleRowPress = (item: RecordingFile) => {
    navigation.navigate("Playback", { uri: item.uri, name: item.name });
  };

  const renderItem = ({ item }: { item: RecordingFile }) => {
    const isSelected = selectedUris.has(item.uri);
    const uploadStatus = uploadStatuses.get(item.name) ?? "not_queued";
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => handleRowPress(item)}
      >
        <TouchableOpacity
          style={styles.checkbox}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => toggleSelection(item.uri)}
        >
          {isSelected && <View style={styles.checkboxInner} />}
        </TouchableOpacity>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.name}
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
            (selectedUris.size === 0 || isUploading) && styles.buttonDisabled,
          ]}
          onPress={handleUploadSelected}
          disabled={selectedUris.size === 0 || isUploading}
        >
          <Text style={styles.toolbarButtonText}>
            {isUploading ? "アップロード中..." : `アップロード (${selectedUris.size})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            styles.deleteButton,
            selectedUris.size === 0 && styles.buttonDisabled,
          ]}
          onPress={handleDeleteSelected}
          disabled={selectedUris.size === 0}
        >
          <Text style={styles.toolbarButtonText}>削除 ({selectedUris.size})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            styles.deleteAllButton,
            files.length === 0 && styles.buttonDisabled,
          ]}
          onPress={handleDeleteAll}
          disabled={files.length === 0}
        >
          <Text style={styles.toolbarButtonText}>全件削除</Text>
        </TouchableOpacity>
      </View>

      {files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>録音ファイルがありません</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.uri}
          renderItem={renderItem}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
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
