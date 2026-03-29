import { randomUUID } from "node:crypto";
import type { MediaItem } from "../types.js";

const PICKER_API = "https://photospicker.googleapis.com/v1";

async function pickerRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${PICKER_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Photos Picker API error (${res.status}): ${body}`);
  }
  return res.json();
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string;
    timeoutIn: string;
  };
  mediaItemsSet: boolean;
  expireTime: string;
}

export async function createPickerSession(
  accessToken: string,
): Promise<PickerSession> {
  const data = await pickerRequest(accessToken, "/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data as PickerSession;
}

export async function getPickerSession(
  accessToken: string,
  sessionId: string,
): Promise<PickerSession> {
  const data = await pickerRequest(accessToken, `/sessions/${sessionId}`);
  return data as PickerSession;
}

export async function listPickerMediaItems(
  accessToken: string,
  sessionId: string,
): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    let path = `/mediaItems?sessionId=${sessionId}`;
    if (pageToken) path += `&pageToken=${pageToken}`;

    const data = (await pickerRequest(accessToken, path)) as {
      mediaItems?: Array<{
        id: string;
        type: "PHOTO" | "VIDEO";
        mediaFile: {
          baseUrl: string;
          mimeType: string;
          filename: string;
          mediaFileMetadata?: {
            width?: string;
            height?: string;
          };
        };
      }>;
      nextPageToken?: string;
    };

    for (const item of data.mediaItems ?? []) {
      items.push({
        id: randomUUID(),
        name: item.mediaFile.filename,
        mimeType: item.mediaFile.mimeType,
        thumbnailUrl: `${item.mediaFile.baseUrl}=w400-h400`,
        sourceFileId: item.id,
        width: parseInt(item.mediaFile.mediaFileMetadata?.width ?? "0", 10),
        height: parseInt(item.mediaFile.mediaFileMetadata?.height ?? "0", 10),
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export async function deletePickerSession(
  accessToken: string,
  sessionId: string,
): Promise<void> {
  await pickerRequest(accessToken, `/sessions/${sessionId}`, {
    method: "DELETE",
  });
}
