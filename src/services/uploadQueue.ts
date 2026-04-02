import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("decibel_buffer.db");

db.execSync(
  `CREATE TABLE IF NOT EXISTS upload_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audio_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    drive_file_id TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
);

export type UploadStatus = "pending" | "uploading" | "uploaded" | "failed";

export type UploadQueueItem = {
  id: number;
  audio_filename: string;
  file_type: string;
  status: UploadStatus;
  drive_file_id: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

const MAX_RETRY = 5;

export const enqueueRecording = (audioFilename: string): void => {
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    db.runSync(
      "INSERT INTO upload_queue (audio_filename, file_type, status, retry_count, created_at, updated_at) VALUES (?, ?, 'pending', 0, ?, ?)",
      audioFilename,
      "m4a",
      now,
      now,
    );
    db.runSync(
      "INSERT INTO upload_queue (audio_filename, file_type, status, retry_count, created_at, updated_at) VALUES (?, ?, 'pending', 0, ?, ?)",
      audioFilename,
      "csv",
      now,
      now,
    );
    db.runSync(
      "INSERT INTO upload_queue (audio_filename, file_type, status, retry_count, created_at, updated_at) VALUES (?, ?, 'pending', 0, ?, ?)",
      audioFilename,
      "json",
      now,
      now,
    );
  });
};

export const enqueueMetaUpload = (segmentPath: string): void => {
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    db.runSync(
      "DELETE FROM upload_queue WHERE audio_filename = ? AND file_type = 'json'",
      segmentPath,
    );
    db.runSync(
      "INSERT INTO upload_queue (audio_filename, file_type, status, retry_count, created_at, updated_at) VALUES (?, ?, 'pending', 0, ?, ?)",
      segmentPath,
      "json",
      now,
      now,
    );
  });
};

export const getPendingUploads = (): UploadQueueItem[] => {
  return db.getAllSync<UploadQueueItem>(
    "SELECT * FROM upload_queue WHERE status = 'pending' OR (status = 'failed' AND retry_count < ?) ORDER BY created_at ASC",
    MAX_RETRY,
  );
};

export const markUploading = (id: number): void => {
  db.runSync(
    "UPDATE upload_queue SET status = 'uploading', updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id,
  );
};

export const markUploaded = (id: number, driveFileId: string): void => {
  db.runSync(
    "UPDATE upload_queue SET status = 'uploaded', drive_file_id = ?, updated_at = ? WHERE id = ?",
    driveFileId,
    new Date().toISOString(),
    id,
  );
};

export const markFailed = (id: number): void => {
  db.runSync(
    "UPDATE upload_queue SET status = 'failed', retry_count = retry_count + 1, updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id,
  );
};

export type FileUploadStatus = "not_queued" | "pending" | "uploading" | "uploaded" | "failed";

export const getUploadStatusForFile = (audioFilename: string): FileUploadStatus => {
  const rows = db.getAllSync<{ status: UploadStatus }>(
    "SELECT status FROM upload_queue WHERE audio_filename = ?",
    audioFilename,
  );
  if (rows.length === 0) return "not_queued";
  const allUploaded = rows.every((r) => r.status === "uploaded");
  if (allUploaded) return "uploaded";
  const anyUploading = rows.some((r) => r.status === "uploading");
  if (anyUploading) return "uploading";
  const anyFailed = rows.some((r) => r.status === "failed");
  if (anyFailed) return "failed";
  return "pending";
};

export const getAllUploadStatuses = (): Map<string, FileUploadStatus> => {
  const rows = db.getAllSync<{ audio_filename: string; status: UploadStatus }>(
    "SELECT audio_filename, status FROM upload_queue",
  );

  // Group statuses by audio_filename
  const grouped = new Map<string, UploadStatus[]>();
  for (const row of rows) {
    const list = grouped.get(row.audio_filename);
    if (list) {
      list.push(row.status);
    } else {
      grouped.set(row.audio_filename, [row.status]);
    }
  }

  // Derive aggregate status per file
  const result = new Map<string, FileUploadStatus>();
  for (const [filename, statuses] of grouped) {
    if (statuses.every((s) => s === "uploaded")) {
      result.set(filename, "uploaded");
    } else if (statuses.some((s) => s === "uploading")) {
      result.set(filename, "uploading");
    } else if (statuses.some((s) => s === "failed")) {
      result.set(filename, "failed");
    } else {
      result.set(filename, "pending");
    }
  }
  return result;
};

export const getUploadedItems = (): UploadQueueItem[] => {
  return db.getAllSync<UploadQueueItem>(
    "SELECT * FROM upload_queue WHERE status = 'uploaded' AND drive_file_id IS NOT NULL",
  );
};

export const markPending = (id: number): void => {
  db.runSync(
    "UPDATE upload_queue SET status = 'pending', drive_file_id = NULL, retry_count = 0, updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id,
  );
};

export const resetForReupload = (audioFilename: string): void => {
  db.runSync(
    "UPDATE upload_queue SET status = 'pending', retry_count = 0, drive_file_id = NULL, updated_at = ? WHERE audio_filename = ?",
    new Date().toISOString(),
    audioFilename,
  );
};
