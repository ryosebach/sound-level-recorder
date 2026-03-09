import NetInfo from "@react-native-community/netinfo";
import { getRecordingUri } from "@/utils/fileManager";
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

        const isAudio = item.file_type === "m4a";
        const filename = isAudio
          ? item.audio_filename
          : item.audio_filename.replace(/\.m4a$/, ".csv");
        const fileUri = getRecordingUri(filename);
        const mimeType = isAudio ? "audio/mp4" : "text/csv";

        let driveFileId: string;
        if (isAudio) {
          driveFileId = await uploadResumable(filename, fileUri, mimeType, dateFolderId, token);
        } else {
          driveFileId = await uploadMultipart(filename, fileUri, mimeType, dateFolderId, token);
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

export const triggerUploadAfterSplit = (audioFilename: string): void => {
  enqueueRecording(audioFilename);
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

export const uploadManual = async (audioFilenames: string[]): Promise<void> => {
  if (!isSignedIn()) {
    throw new Error("Google アカウントにサインインしてください");
  }

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    throw new Error("ネットワークに接続されていません");
  }

  for (const audioFilename of audioFilenames) {
    const status = getUploadStatusForFile(audioFilename);
    if (status === "not_queued") {
      enqueueRecording(audioFilename);
    } else if (status === "failed") {
      resetForReupload(audioFilename);
    }
  }

  await processPending();
};
