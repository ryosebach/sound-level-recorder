import { File, Directory, Paths } from "expo-file-system/next";

const RECORDINGS_DIR = "recordings";

export type SegmentFile = {
  segmentId: string;
  audioUri: string;
  size: number;
};

export type RecordingSession = {
  sessionId: string;
  segments: SegmentFile[];
};

const getRecordingDir = (): Directory => {
  return new Directory(Paths.document, RECORDINGS_DIR);
};

export const ensureRecordingDir = (): void => {
  const dir = getRecordingDir();
  if (!dir.exists) {
    dir.create();
  }
};

const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
};

export const generateSessionId = (): string => {
  return `session_${formatTimestamp(new Date())}`;
};

export const moveRecording = (
  sourceUri: string,
  sessionId: string,
  segmentStartedAt: Date,
): { sessionId: string; segmentId: string } => {
  ensureRecordingDir();
  const segmentId = `segment_${formatTimestamp(segmentStartedAt)}`;

  const sessionDir = new Directory(getRecordingDir(), sessionId);
  if (!sessionDir.exists) {
    sessionDir.create();
  }

  const segmentDir = new Directory(sessionDir, segmentId);
  segmentDir.create();

  const dest = new File(segmentDir, "audio.m4a");
  const src = new File(sourceUri);
  src.move(dest);

  return { sessionId, segmentId };
};

export const getAudioUri = (sessionId: string, segmentId: string): string => {
  return new File(getRecordingDir(), sessionId, segmentId, "audio.m4a").uri;
};

export const getCsvUri = (sessionId: string, segmentId: string): string => {
  return new File(getRecordingDir(), sessionId, segmentId, "decibel.csv").uri;
};

export const getSegmentPath = (sessionId: string, segmentId: string): string => {
  return `${sessionId}/${segmentId}`;
};

export const writeDecibelCsv = (
  csvContent: string,
  sessionId: string,
  segmentId: string,
): string => {
  ensureRecordingDir();
  const dest = new File(getRecordingDir(), sessionId, segmentId, "decibel.csv");
  dest.write(csvContent);
  return dest.uri;
};

export const listRecordingSessions = (): RecordingSession[] => {
  const dir = getRecordingDir();
  if (!dir.exists) {
    return [];
  }

  const sessions: RecordingSession[] = [];
  const entries = dir.list();

  for (const entry of entries) {
    if (!(entry instanceof Directory)) continue;
    const sessionId = entry.name;
    if (!sessionId.startsWith("session_")) continue;

    const segments: SegmentFile[] = [];
    const segEntries = entry.list();

    for (const segEntry of segEntries) {
      if (!(segEntry instanceof Directory)) continue;
      const segmentId = segEntry.name;
      if (!segmentId.startsWith("segment_")) continue;

      const audioFile = new File(segEntry, "audio.m4a");
      if (!audioFile.exists) continue;

      segments.push({
        segmentId,
        audioUri: audioFile.uri,
        size: audioFile.size ?? 0,
      });
    }

    segments.sort((a, b) => a.segmentId.localeCompare(b.segmentId));

    if (segments.length > 0) {
      sessions.push({ sessionId, segments });
    }
  }

  sessions.sort((a, b) => b.sessionId.localeCompare(a.sessionId));
  return sessions;
};

export const deleteSegment = (sessionId: string, segmentId: string): void => {
  const segmentDir = new Directory(getRecordingDir(), sessionId, segmentId);
  if (segmentDir.exists) {
    segmentDir.delete();
  }

  // Remove session dir if empty
  const sessionDir = new Directory(getRecordingDir(), sessionId);
  if (sessionDir.exists) {
    const remaining = sessionDir.list();
    if (remaining.length === 0) {
      sessionDir.delete();
    }
  }
};

export const deleteSession = (sessionId: string): void => {
  const sessionDir = new Directory(getRecordingDir(), sessionId);
  if (sessionDir.exists) {
    sessionDir.delete();
  }
};

export const deleteAllRecordings = (): void => {
  const dir = getRecordingDir();
  if (!dir.exists) {
    return;
  }
  const entries = dir.list();
  for (const entry of entries) {
    if (entry instanceof Directory) {
      entry.delete();
    } else if (entry instanceof File) {
      // Clean up any leftover flat files
      entry.delete();
    }
  }
};
