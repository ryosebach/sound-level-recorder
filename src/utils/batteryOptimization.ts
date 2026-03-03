import { Alert, Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { isIgnoringBatteryOptimizations } from "../../modules/battery-optimization/src";

const MANUFACTURER_GUIDE_MAP: Record<string, string> = {
  samsung: "https://dontkillmyapp.com/samsung",
  xiaomi: "https://dontkillmyapp.com/xiaomi",
  huawei: "https://dontkillmyapp.com/huawei",
  oppo: "https://dontkillmyapp.com/oppo",
  vivo: "https://dontkillmyapp.com/vivo",
  oneplus: "https://dontkillmyapp.com/oneplus",
  sony: "https://dontkillmyapp.com/sony",
};

export const requestIgnoreBatteryOptimizations = async (): Promise<void> => {
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: "package:com.ryosebach.soundlevelrecorder" },
    );
  } catch {
    // Fallback: open the battery optimization settings list
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
    );
  }
};

export const getManufacturerGuideUrl = (): string | null => {
  if (Platform.OS !== "android") return null;
  const brand = (
    (Platform.constants as Record<string, unknown>).Brand as string | undefined
  )
    ?.toLowerCase()
    ?.trim();
  if (!brand) return null;
  return MANUFACTURER_GUIDE_MAP[brand] ?? null;
};

export const openManufacturerGuide = async (): Promise<void> => {
  const url = getManufacturerGuideUrl();
  if (url) {
    await Linking.openURL(url);
  }
};

export const showBatteryOptimizationAlert = (): Promise<void> => {
  return new Promise((resolve) => {
    Alert.alert(
      "バッテリー最適化の除外",
      "バックグラウンド録音が停止されないよう、バッテリー最適化の除外設定を推奨します。",
      [
        {
          text: "後で",
          style: "cancel",
          onPress: () => resolve(),
        },
        {
          text: "設定を開く",
          onPress: async () => {
            await requestIgnoreBatteryOptimizations();
            resolve();
          },
        },
      ],
    );
  });
};

export const maybeShowBatteryOptimizationAlert = async (): Promise<void> => {
  if (Platform.OS !== "android") return;
  if (isIgnoringBatteryOptimizations()) return;
  await showBatteryOptimizationAlert();
};
