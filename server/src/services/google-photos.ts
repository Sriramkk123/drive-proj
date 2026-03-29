import { randomUUID } from "node:crypto";
import type { MediaItem } from "../types.js";
import { ExportFailedError } from "../errors.js";

const PHOTOS_API = "https://photoslibrary.googleapis.com/v1";

async function photosRequest(accessToken: string, path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${PHOTOS_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Photos API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function getAlbumName(accessToken: string, albumId: string): Promise<string> {
  const data = (await photosRequest(accessToken, `/albums/${albumId}`)) as { title?: string };
  return data.title ?? "Untitled Album";
}

export async function listPhotosMedia(accessToken: string, albumId: string): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = { albumId, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;

    const data = (await photosRequest(accessToken, "/mediaItems:search", {
      method: "POST",
      body: JSON.stringify(body),
    })) as {
      mediaItems?: Array<{
        id: string; filename: string; mimeType: string; baseUrl: string;
        mediaMetadata?: { width?: string; height?: string };
      }>;
      nextPageToken?: string;
    };

    for (const item of data.mediaItems ?? []) {
      items.push({
        id: randomUUID(),
        name: item.filename,
        mimeType: item.mimeType,
        thumbnailUrl: `${item.baseUrl}=w400-h400`,
        sourceFileId: item.id,
        width: parseInt(item.mediaMetadata?.width ?? "0", 10),
        height: parseInt(item.mediaMetadata?.height ?? "0", 10),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export async function createPhotosAlbum(accessToken: string, name: string): Promise<string> {
  try {
    const data = (await photosRequest(accessToken, "/albums", {
      method: "POST",
      body: JSON.stringify({ album: { title: name } }),
    })) as { id: string };
    return data.id;
  } catch (err) {
    throw new ExportFailedError(`Failed to create Photos album: ${(err as Error).message}`);
  }
}

export async function addItemsToAlbum(accessToken: string, albumId: string, mediaItemIds: string[]): Promise<void> {
  try {
    await photosRequest(accessToken, `/albums/${albumId}:batchAddMediaItems`, {
      method: "POST",
      body: JSON.stringify({ mediaItemIds }),
    });
  } catch (err) {
    throw new ExportFailedError(`Failed to add items to album: ${(err as Error).message}`);
  }
}
