import { Alert, Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Battery from "expo-battery";

const MANUFACTURER_GUIDE_MAP: Record<string, string> = {
  samsung: "https://dontkillmyapp.com/samsung",
  xiaomi: "https://dontkillmyapp.com/xiaomi",
  huawei: "https://dontkillmyapp.com/huawei",
  oppo: "https://dontkillmyapp.com/oppo",
  vivo: "https://dontkillmyapp.com/vivo",
  oneplus: "https://dontkillmyapp.com/oneplus",
  sony: "https://dontkillmyapp.com/sony",
};

export const isBatteryOptimizationEnabled = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  return Battery.isBatteryOptimizationEnabledAsync();
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
  const brand = ((Platform.constants as Record<string, unknown>).Brand as string | undefined)
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

/**
 * Returns true if the user chose "後で" (proceed with recording),
 * false if the user chose "設定を開く" (recording should be skipped).
 */
const showBatteryOptimizationAlert = (): Promise<boolean> => {
  return new Promise((resolve) => {
    Alert.alert(
      "バッテリー最適化の除外",
      "バックグラウンド録音が停止されないよう、バッテリー最適化の除外設定を推奨します。",
      [
        {
          text: "後で",
          style: "cancel",
          onPress: () => resolve(true),
        },
        {
          text: "設定を開く",
          onPress: () => {
            resolve(false);
            // Alert 閉じアニメーション完了後に Intent を起動
            setTimeout(() => {
              requestIgnoreBatteryOptimizations();
            }, 500);
          },
        },
      ],
      { cancelable: false },
    );
  });
};

/**
 * Returns true if recording should proceed, false if the user
 * chose to open battery settings (recording should be skipped).
 */
export const maybeShowBatteryOptimizationAlert = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return true;
  const optimizationEnabled = await isBatteryOptimizationEnabled();
  if (!optimizationEnabled) return true;
  return showBatteryOptimizationAlert();
};
