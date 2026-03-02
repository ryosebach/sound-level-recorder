import { File, Directory, Paths } from "expo-file-system/next";

const RECORDINGS_DIR = "recordings";

export function getTotalStorageBytes(): number {
  const dir = new Directory(Paths.document, RECORDINGS_DIR);
  if (!dir.exists) return 0;

  let total = 0;
  const entries = dir.list();
  for (const entry of entries) {
    if (entry instanceof File) {
      total += entry.size ?? 0;
    }
  }
  return total;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
