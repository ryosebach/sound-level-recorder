import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import {
  listRecordingSessions,
  deleteSegment,
  deleteAllRecordings,
  getSegmentPath,
  writeMeta,
  type SegmentFile,
} from "@/utils/fileManager";
import colors from "@/theme/colors";
import { uploadManual, syncDriveStatus, triggerMetaUpload } from "@/services/uploadManager";
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
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuButtonRef = useRef<View>(null);
  const listRef = useRef<SectionList<SegmentFile, SectionData>>(null);
  const scrollOffsetRef = useRef(0);
  const listHeightRef = useRef(0);

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

  const handleContentSizeChange = useCallback((_w: number, contentHeight: number) => {
    const maxOffset = Math.max(0, contentHeight - listHeightRef.current);
    if (scrollOffsetRef.current > maxOffset) {
      listRef.current?.getScrollResponder()?.scrollTo({ y: maxOffset, animated: false });
    }
  }, []);

  useFocusEffect(loadFiles);

  const filteredSections = useMemo(() => {
    if (!filterFavorite) return sections;
    return sections
      .map((s) => {
        const filtered = s.data.filter((seg) => seg.meta.favorite);
        return {
          ...s,
          data: filtered,
          segmentCount: filtered.length,
          totalSize: filtered.reduce((sum, seg) => sum + seg.size, 0),
        };
      })
      .filter((s) => s.data.length > 0);
  }, [sections, filterFavorite]);

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

  const openMenu = () => {
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({ top: y + height + 4, right: 16 });
      setMenuVisible(true);
    });
  };

  const handleToggleFavorite = (sessionId: string, item: SegmentFile) => {
    writeMeta(sessionId, item.segmentId, { favorite: !item.meta.favorite });
    triggerMetaUpload(getSegmentPath(sessionId, item.segmentId));
    loadFiles();
  };

  const handleRowPress = (sessionId: string, item: SegmentFile) => {
    navigation.navigate("Playback", {
      uri: item.audioUri,
      name: item.segmentId,
      sessionId,
      segmentId: item.segmentId,
    });
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
            {item.meta.comment !== "" && <Text style={styles.commentIcon}>💬</Text>}
            {uploadStatus !== "not_queued" && (
              <Text style={[styles.uploadStatus, { color: UPLOAD_STATUS_COLORS[uploadStatus] }]}>
                {UPLOAD_STATUS_LABELS[uploadStatus]}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.favoriteButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => handleToggleFavorite(section.sessionId, item)}
        >
          <Text style={[styles.favoriteIcon, item.meta.favorite && styles.favoriteActive]}>
            {item.meta.favorite ? "\u2605" : "\u2606"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const totalSegments = filteredSections.reduce((sum, s) => sum + s.segmentCount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarButton, styles.filterButton, filterFavorite && styles.filterActive]}
          onPress={() => setFilterFavorite((prev) => !prev)}
        >
          <Text style={styles.toolbarButtonText}>
            {filterFavorite ? "\u2605 お気に入り" : "\u2606 フィルタ"}
          </Text>
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
        <View ref={menuButtonRef} collapsable={false}>
          <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
            <Text style={styles.menuButtonText}>{"\u22EF"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[styles.menuDropdown, { top: menuPosition.top, right: menuPosition.right }]}
              >
                <TouchableOpacity
                  style={[styles.menuItem, isSyncing && styles.buttonDisabled]}
                  onPress={() => {
                    setMenuVisible(false);
                    handleSyncStatus();
                  }}
                  disabled={isSyncing}
                >
                  <Text style={styles.menuItemText}>{isSyncing ? "同期中..." : "Drive 同期"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, totalSegments === 0 && styles.buttonDisabled]}
                  onPress={() => {
                    setMenuVisible(false);
                    handleDeleteAll();
                  }}
                  disabled={totalSegments === 0}
                >
                  <Text style={[styles.menuItemText, styles.menuItemDestructive]}>全件削除</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {totalSegments === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>録音ファイルがありません</Text>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={filteredSections}
          keyExtractor={(item, index) => item.segmentId + index}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onLayout={(e) => {
            listHeightRef.current = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={handleContentSizeChange}
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
  toolbarSpacer: {
    flex: 1,
  },
  uploadButton: {
    backgroundColor: colors.accentBlue,
  },
  deleteButton: {
    backgroundColor: colors.accentRed,
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  menuButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  menuOverlay: {
    flex: 1,
  },
  menuDropdown: {
    position: "absolute",
    backgroundColor: colors.bgSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minWidth: 160,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  menuItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  menuItemDestructive: {
    color: colors.accentRed,
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
  commentIcon: {
    fontSize: 12,
  },
  uploadStatus: {
    fontSize: 11,
    fontWeight: "bold",
  },
  favoriteButton: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  favoriteIcon: {
    fontSize: 22,
    color: colors.textMuted,
  },
  favoriteActive: {
    color: colors.accentOrange,
  },
  filterButton: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  filterActive: {
    backgroundColor: colors.accentOrange,
    borderColor: colors.accentOrange,
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
