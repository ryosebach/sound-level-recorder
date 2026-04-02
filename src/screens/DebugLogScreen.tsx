import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { readLog, clearLog } from "@/utils/debugLog";
import colors from "@/theme/colors";

const DebugLogScreen = () => {
  const [logText, setLogText] = useState("");

  useFocusEffect(
    useCallback(() => {
      setLogText(readLog());
    }, []),
  );

  const handleClear = () => {
    clearLog();
    setLogText("(クリア済み)");
  };

  const handleRefresh = () => {
    setLogText(readLog());
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.buttonText}>更新</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.buttonText}>クリア</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logText} selectable>
          {logText}
        </Text>
      </ScrollView>
    </View>
  );
};

export default DebugLogScreen;

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
  refreshButton: {
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButton: {
    backgroundColor: colors.accentRed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  logText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
