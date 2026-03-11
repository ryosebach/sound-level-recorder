import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("decibel_buffer.db");

db.execSync(
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
);

const KEY_SPLIT_INTERVAL = "split_interval_ms";
const KEY_GOOGLE_DRIVE_ENABLED = "google_drive_enabled";
const KEY_WIFI_ONLY_UPLOAD = "wifi_only_upload";

export type SplitIntervalOption = {
  label: string;
  value: number | null;
};

export const SPLIT_INTERVAL_OPTIONS: SplitIntervalOption[] = [
  { label: "30秒", value: 30_000 },
  { label: "30分", value: 1_800_000 },
  { label: "1時間", value: 3_600_000 },
  { label: "3時間", value: 10_800_000 },
  { label: "6時間", value: 21_600_000 },
  { label: "12時間", value: 43_200_000 },
  { label: "OFF", value: null },
];

const DEFAULT_SPLIT_INTERVAL_MS = 21_600_000; // 6 hours

export const getSplitIntervalMs = (): number | null => {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    KEY_SPLIT_INTERVAL,
  );
  if (row == null) return DEFAULT_SPLIT_INTERVAL_MS;
  if (row.value === "null") return null;
  return Number(row.value);
};

export const setSplitIntervalMs = (value: number | null): void => {
  db.runSync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    KEY_SPLIT_INTERVAL,
    String(value),
  );
};

export const getGoogleDriveEnabled = (): boolean => {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    KEY_GOOGLE_DRIVE_ENABLED,
  );
  return row?.value === "true";
};

export const setGoogleDriveEnabled = (value: boolean): void => {
  db.runSync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    KEY_GOOGLE_DRIVE_ENABLED,
    String(value),
  );
};

export const getWifiOnlyUpload = (): boolean => {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    KEY_WIFI_ONLY_UPLOAD,
  );
  if (row == null) return true; // default: Wi-Fi only
  return row.value === "true";
};

export const setWifiOnlyUpload = (value: boolean): void => {
  db.runSync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    KEY_WIFI_ONLY_UPLOAD,
    String(value),
  );
};
