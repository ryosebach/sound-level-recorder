import NetInfo from "@react-native-community/netinfo";
import { getAudioUri, getCsvUri } from "@/utils/fileManager";
import { getGoogleDriveEnabled, getWifiOnlyUpload } from "@/utils/settingsStore";
import { isSignedIn, getAccessToken } from "@/services/googleAuth";
import { ensureFolder, uploadMultipart, uploadResumable, fileExists } from "@/services/driveApi";
import {
  enqueueRecording,
  getPendingUploads,
  markUploading,
  markUploaded,
  markFailed,
  getUploadStatusForFile,
  resetForReupload,
  getUploadedItems,
  markPending,
} from "@/services/uploadQueue";

const ROOT_FOLDER_NAME = "SoundLevelRecorder";

let isProcessing = false;

const getDateFolder = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const canAutoUpload = async (): Promise<boolean> => {
  if (!getGoogleDriveEnabled()) return false;
  if (!isSignedIn()) return false;

  const wifiOnly = getWifiOnlyUpload();
  if (wifiOnly) {
    const state = await NetInfo.fetch();
    if (state.type !== "wifi") return false;
  } else {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return false;
  }

  return true;
};

const parseSegmentPath = (segmentPath: string): { sessionId: string; segmentId: string } => {
  const [sessionId, segmentId] = segmentPath.split("/");
  return { sessionId, segmentId };
};

const processPending = async (): Promise<void> => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = getPendingUploads();
    if (pending.length === 0) return;

    const token = await getAccessToken();
    const rootFolderId = await ensureFolder(ROOT_FOLDER_NAME, null, token);
    const dateFolderId = await ensureFolder(getDateFolder(), rootFolderId, token);

    for (const item of pending) {
      try {
        markUploading(item.id);

        const { sessionId, segmentId } = parseSegmentPath(item.audio_filename);
        const isAudio = item.file_type === "m4a";
        const driveFilename = isAudio ? `${segmentId}.m4a` : `${segmentId}.csv`;
        const fileUri = isAudio
          ? getAudioUri(sessionId, segmentId)
          : getCsvUri(sessionId, segmentId);
        const mimeType = isAudio ? "audio/mp4" : "text/csv";

        let driveFileId: string;
        if (isAudio) {
          driveFileId = await uploadResumable(
            driveFilename,
            fileUri,
            mimeType,
            dateFolderId,
            token,
          );
        } else {
          driveFileId = await uploadMultipart(
            driveFilename,
            fileUri,
            mimeType,
            dateFolderId,
            token,
          );
        }

        markUploaded(item.id, driveFileId);
      } catch {
        markFailed(item.id);
      }
    }
  } finally {
    isProcessing = false;
  }
};

export const processUploadQueue = async (): Promise<void> => {
  if (!(await canAutoUpload())) return;
  await processPending();
};

export const triggerUploadAfterSplit = (segmentPath: string): void => {
  enqueueRecording(segmentPath);
  processUploadQueue().catch(() => {});
};

export const syncDriveStatus = async (): Promise<number> => {
  if (!isSignedIn()) {
    throw new Error("Google アカウントにサインインしてください");
  }

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    throw new Error("ネットワークに接続されていません");
  }

  const uploaded = getUploadedItems();
  if (uploaded.length === 0) return 0;

  const token = await getAccessToken();
  let resetCount = 0;

  for (const item of uploaded) {
    const exists = await fileExists(item.drive_file_id!, token);
    if (!exists) {
      markPending(item.id);
      resetCount++;
    }
  }

  return resetCount;
};

export const uploadManual = async (segmentPaths: string[]): Promise<void> => {
  if (!isSignedIn()) {
    throw new Error("Google アカウントにサインインしてください");
  }

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    throw new Error("ネットワークに接続されていません");
  }

  for (const segmentPath of segmentPaths) {
    const status = getUploadStatusForFile(segmentPath);
    if (status === "not_queued") {
      enqueueRecording(segmentPath);
    } else if (status === "failed") {
      resetForReupload(segmentPath);
    }
  }

  await processPending();
};
