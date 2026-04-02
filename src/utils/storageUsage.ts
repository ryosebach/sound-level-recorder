import { File, Directory, Paths } from "expo-file-system/next";

const RECORDINGS_DIR = "recordings";

const sumDirectorySize = (dir: Directory): number => {
  let total = 0;
  const entries = dir.list();
  for (const entry of entries) {
    if (entry instanceof File) {
      total += entry.size ?? 0;
    } else if (entry instanceof Directory) {
      total += sumDirectorySize(entry);
    }
  }
  return total;
};

export const getTotalStorageBytes = (): number => {
  const dir = new Directory(Paths.document, RECORDINGS_DIR);
  if (!dir.exists) return 0;
  return sumDirectorySize(dir);
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
