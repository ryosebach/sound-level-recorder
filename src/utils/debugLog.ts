import { File, Paths } from "expo-file-system/next";
import { getDebugLogEnabled } from "@/utils/settingsStore";

const LOG_FILE = "debug.log";

const getLogFile = (): File => {
  return new File(Paths.document, LOG_FILE);
};

export const appendLog = (message: string): void => {
  try {
    if (!getDebugLogEnabled()) return;
    const file = getLogFile();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    if (file.exists) {
      const current = file.textSync();
      file.write(current + line);
    } else {
      file.write(line);
    }
  } catch {
    // Silently ignore logging errors
  }
};

export const readLog = (): string => {
  try {
    const file = getLogFile();
    if (!file.exists) return "(ログなし)";
    return file.textSync();
  } catch {
    return "(ログ読み取りエラー)";
  }
};

export const clearLog = (): void => {
  try {
    const file = getLogFile();
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Silently ignore
  }
};
