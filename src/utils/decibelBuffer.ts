import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("decibel_buffer.db");

db.execSync("PRAGMA journal_mode=WAL");
db.execSync(
  `CREATE TABLE IF NOT EXISTS decibel_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    offset_ms INTEGER NOT NULL,
    db REAL NOT NULL
  )`
);

export function insertDecibel(
  timestampIso: string,
  offsetMs: number,
  dbfs: number
): void {
  db.runSync(
    "INSERT INTO decibel_log (ts, offset_ms, db) VALUES (?, ?, ?)",
    timestampIso,
    offsetMs,
    dbfs
  );
}

export function exportDecibelCsv(fromIso: string, toIso: string): string {
  const rows = db.getAllSync<{ ts: string; offset_ms: number; db: number }>(
    "SELECT ts, offset_ms, db FROM decibel_log WHERE ts >= ? AND ts <= ? ORDER BY ts",
    fromIso,
    toIso
  );

  const lines = ["timestamp,offset_ms,db"];
  for (const row of rows) {
    lines.push(`${row.ts},${row.offset_ms},${row.db}`);
  }
  return lines.join("\n") + "\n";
}

export function deleteDecibelRows(fromIso: string, toIso: string): void {
  db.runSync(
    "DELETE FROM decibel_log WHERE ts >= ? AND ts <= ?",
    fromIso,
    toIso
  );
}

export function getRecentDecibels(
  limitMs: number
): { offset_ms: number; db: number; ts: string }[] {
  const sinceIso = new Date(Date.now() - limitMs).toISOString();
  return db.getAllSync<{ offset_ms: number; db: number; ts: string }>(
    "SELECT ts, offset_ms, db FROM decibel_log WHERE ts >= ? ORDER BY ts",
    sinceIso
  );
}

export function clearAllDecibelRows(): void {
  db.runSync("DELETE FROM decibel_log");
}
