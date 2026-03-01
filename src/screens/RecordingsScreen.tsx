import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  listRecordings,
  deleteRecording,
  deleteAllRecordings,
  type RecordingFile,
} from "@/utils/fileManager";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecordingsScreen() {
  const [files, setFiles] = useState<RecordingFile[]>([]);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());

  const loadFiles = useCallback(() => {
    setFiles(listRecordings());
    setSelectedUris(new Set());
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
    Alert.alert(
      "選択したファイルを削除",
      `${selectedUris.size} 件のファイルを削除しますか？`,
      [
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
      ]
    );
  };

  const handleDeleteAll = () => {
    if (files.length === 0) return;
    Alert.alert(
      "全件削除",
      `${files.length} 件のファイルをすべて削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "全件削除",
          style: "destructive",
          onPress: () => {
            deleteAllRecordings();
            loadFiles();
          },
        },
      ]
    );
  };

  const handleRowPress = (_item: RecordingFile) => {
    // TODO: navigate to playback screen
  };

  const renderItem = ({ item }: { item: RecordingFile }) => {
    const isSelected = selectedUris.has(item.uri);
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
          <Text style={styles.fileMeta}>{formatFileSize(item.size)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            styles.deleteButton,
            selectedUris.size === 0 && styles.buttonDisabled,
          ]}
          onPress={handleDeleteSelected}
          disabled={selectedUris.size === 0}
        >
          <Text style={styles.toolbarButtonText}>
            選択削除 ({selectedUris.size})
          </Text>
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  toolbarButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: "#e53e3e",
  },
  deleteAllButton: {
    backgroundColor: "#dd6b20",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  toolbarButtonText: {
    color: "#fff",
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
    borderBottomColor: "#f0f0f0",
  },
  rowSelected: {
    backgroundColor: "#ebf8ff",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#a0aec0",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#3182ce",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2d3748",
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 12,
    color: "#a0aec0",
  },
  listFooter: {
    alignItems: "center",
    paddingVertical: 24,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#cbd5e0",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#a0aec0",
  },
});
