import { File, Directory, Paths } from "expo-file-system/next";

const RECORDINGS_DIR = "recordings";

export type RecordingFile = {
  uri: string;
  name: string;
  size: number;
  createdAt: number | null;
};

function getRecordingDir(): Directory {
  return new Directory(Paths.document, RECORDINGS_DIR);
}

export function ensureRecordingDir(): void {
  const dir = getRecordingDir();
  if (!dir.exists) {
    dir.create();
  }
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
}

export function moveRecording(sourceUri: string): string {
  ensureRecordingDir();
  const filename = `recording_${formatTimestamp(new Date())}.m4a`;
  const dest = new File(getRecordingDir(), filename);
  const src = new File(sourceUri);
  src.move(dest);
  return dest.uri;
}

export function listRecordings(): RecordingFile[] {
  const dir = getRecordingDir();
  if (!dir.exists) {
    return [];
  }
  const entries = dir.list();
  const files: RecordingFile[] = [];
  for (const entry of entries) {
    if (entry instanceof File) {
      files.push({
        uri: entry.uri,
        name: entry.uri.split("/").pop() ?? entry.uri,
        size: entry.size ?? 0,
        createdAt: null,
      });
    }
  }
  // Sort by name descending (newest first, since names contain timestamps)
  files.sort((a, b) => b.name.localeCompare(a.name));
  return files;
}

export function deleteRecording(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export function deleteAllRecordings(): void {
  const dir = getRecordingDir();
  if (!dir.exists) {
    return;
  }
  const entries = dir.list();
  for (const entry of entries) {
    if (entry instanceof File) {
      entry.delete();
    }
  }
}
