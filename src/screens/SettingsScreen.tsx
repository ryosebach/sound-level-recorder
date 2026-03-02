import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import colors from "@/theme/colors";
import {
  SPLIT_INTERVAL_OPTIONS,
  getSplitIntervalMs,
  setSplitIntervalMs,
} from "@/utils/settingsStore";
import { getTotalStorageBytes, formatBytes } from "@/utils/storageUsage";

export default function SettingsScreen() {
  const [splitInterval, setSplitInterval] = useState<number | null>(
    getSplitIntervalMs
  );
  const [storageBytes, setStorageBytes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setStorageBytes(getTotalStorageBytes());
    }, [])
  );

  const handleSelectInterval = (value: number | null) => {
    setSplitInterval(value);
    setSplitIntervalMs(value);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>分割間隔</Text>
      <View style={styles.chipRow}>
        {SPLIT_INTERVAL_OPTIONS.map((opt) => {
          const selected =
            splitInterval === opt.value;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handleSelectInterval(opt.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>ストレージ使用量</Text>
      <Text style={styles.storageValue}>{formatBytes(storageBytes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipSelected: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.onAccent,
    fontWeight: "bold",
  },
  storageValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
});
