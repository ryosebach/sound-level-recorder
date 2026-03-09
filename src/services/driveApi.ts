import { File } from "expo-file-system/next";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";

export const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export const fileExists = async (driveFileId: string, token: string): Promise<boolean> => {
  const res = await fetch(`${DRIVE_API}/files/${driveFileId}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) return false;
  const data = (await res.json()) as { id: string; trashed?: boolean };
  return !data.trashed;
};

export const ensureFolder = async (
  name: string,
  parentId: string | null,
  token: string,
): Promise<string> => {
  // Search for existing folder
  let q = `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const searchRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const searchData = (await searchRes.json()) as { files: { id: string }[] };
  if (searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const metadata: Record<string, unknown> = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  const createData = (await createRes.json()) as { id: string };
  return createData.id;
};

export const uploadMultipart = async (
  filename: string,
  fileUri: string,
  mimeType: string,
  folderId: string,
  token: string,
): Promise<string> => {
  const file = new File(fileUri);
  const fileContent = await file.base64();

  const boundary = "sound_level_recorder_boundary";
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = (await res.json()) as { id: string };
  return data.id;
};

export const uploadResumable = async (
  filename: string,
  fileUri: string,
  mimeType: string,
  folderId: string,
  token: string,
): Promise<string> => {
  // Step 1: Initiate resumable upload
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
  });

  const initRes = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
    },
    body: metadata,
  });

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Failed to get resumable upload URL");
  }

  // Step 2: Upload file content using legacy uploadAsync
  const uploadResult = await uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    uploadType: FileSystemUploadType.BINARY_CONTENT,
  });

  const data = JSON.parse(uploadResult.body) as { id: string };
  return data.id;
};
