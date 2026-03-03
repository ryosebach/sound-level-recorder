import { requireNativeModule, Platform } from "expo-modules-core";

const BatteryOptimizationModule =
  Platform.OS === "android" ? requireNativeModule("BatteryOptimization") : null;

export const isIgnoringBatteryOptimizations = (): boolean => {
  if (BatteryOptimizationModule == null) return true;
  return BatteryOptimizationModule.isIgnoringBatteryOptimizations();
};
