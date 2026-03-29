import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import type { MediaItem } from "../types.js";
import { ExportFailedError } from "../errors.js";

function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export async function getFolderName(accessToken: string, folderId: string): Promise<string> {
  const drive = createDriveClient(accessToken);
  const res = await drive.files.get({ fileId: folderId, fields: "name" });
  return res.data.name ?? "Untitled Folder";
}

export async function listDriveMedia(accessToken: string, folderId: string): Promise<MediaItem[]> {
  const drive = createDriveClient(accessToken);
  const items: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, thumbnailLink, imageMediaMetadata)",
      pageSize: 100,
      pageToken,
    });

    for (const file of res.data.files ?? []) {
      items.push({
        id: randomUUID(),
        name: file.name ?? "unknown",
        mimeType: file.mimeType ?? "application/octet-stream",
        thumbnailUrl: file.thumbnailLink ?? "",
        sourceFileId: file.id!,
        width: file.imageMediaMetadata?.width ?? 0,
        height: file.imageMediaMetadata?.height ?? 0,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

export async function createDriveFolder(accessToken: string, name: string): Promise<string> {
  const drive = createDriveClient(accessToken);
  try {
    const res = await drive.files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    return res.data.id!;
  } catch (err) {
    throw new ExportFailedError(`Failed to create Drive folder: ${(err as Error).message}`);
  }
}

export async function copyFilesToFolder(accessToken: string, fileIds: string[], folderId: string): Promise<void> {
  const drive = createDriveClient(accessToken);
  const copyPromises = fileIds.map((fileId) =>
    drive.files.copy({ fileId, requestBody: { parents: [folderId] } })
  );
  try {
    await Promise.all(copyPromises);
  } catch (err) {
    throw new ExportFailedError(`Failed to copy files: ${(err as Error).message}`);
  }
}
