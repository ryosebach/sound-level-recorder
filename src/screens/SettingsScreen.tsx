import { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import colors from "@/theme/colors";
import {
  SPLIT_INTERVAL_OPTIONS,
  getSplitIntervalMs,
  setSplitIntervalMs,
} from "@/utils/settingsStore";
import { getTotalStorageBytes, formatBytes } from "@/utils/storageUsage";
import {
  requestIgnoreBatteryOptimizations,
  getManufacturerGuideUrl,
  openManufacturerGuide,
} from "@/utils/batteryOptimization";
import { isIgnoringBatteryOptimizations } from "../../modules/battery-optimization/src";

const SettingsScreen = () => {
  const [splitInterval, setSplitInterval] = useState<number | null>(getSplitIntervalMs);
  const [storageBytes, setStorageBytes] = useState(0);
  const [batteryOptExcluded, setBatteryOptExcluded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setStorageBytes(getTotalStorageBytes());
      if (Platform.OS === "android") {
        setBatteryOptExcluded(isIgnoringBatteryOptimizations());
      }
    }, []),
  );

  const handleSelectInterval = (value: number | null) => {
    setSplitInterval(value);
    setSplitIntervalMs(value);
  };

  const handleRequestBatteryOpt = async () => {
    await requestIgnoreBatteryOptimizations();
    setBatteryOptExcluded(isIgnoringBatteryOptimizations());
  };

  const manufacturerGuideUrl = getManufacturerGuideUrl();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>分割間隔</Text>
      <View style={styles.chipRow}>
        {SPLIT_INTERVAL_OPTIONS.map((opt) => {
          const selected = splitInterval === opt.value;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handleSelectInterval(opt.value)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>ストレージ使用量</Text>
      <Text style={styles.storageValue}>{formatBytes(storageBytes)}</Text>

      {Platform.OS === "android" && (
        <>
          <Text style={styles.sectionTitle}>バッテリー最適化</Text>
          <Text style={styles.statusText}>
            {batteryOptExcluded ? "除外済み" : "未設定（除外を推奨）"}
          </Text>
          {!batteryOptExcluded && (
            <TouchableOpacity style={styles.actionButton} onPress={handleRequestBatteryOpt}>
              <Text style={styles.actionButtonText}>バッテリー最適化の除外を設定</Text>
            </TouchableOpacity>
          )}
          {manufacturerGuideUrl != null && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={openManufacturerGuide}
            >
              <Text style={styles.secondaryButtonText}>メーカー別の設定ガイドを開く</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

export default SettingsScreen;

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
  statusText: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  actionButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  secondaryButtonText: {
    color: colors.accentBlue,
    fontSize: 15,
    fontWeight: "bold",
  },
});
