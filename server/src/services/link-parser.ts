import { InvalidLinkError } from "../errors.js";
import type { SourceType } from "../types.js";

export interface ParsedLink {
  sourceType: SourceType;
  sourceId: string;
}

const DRIVE_FOLDER_RE = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/;
const PHOTOS_ALBUM_RE = /photos\.google\.com\/(?:u\/\d+\/)?(?:share|album)\/([a-zA-Z0-9_-]+)/;
const PHOTOS_SHORT_RE = /photos\.app\.goo\.gl\//;

export async function parseGoogleLink(url: string): Promise<ParsedLink> {
  if (!url) {
    throw new InvalidLinkError();
  }

  const driveMatch = url.match(DRIVE_FOLDER_RE);
  if (driveMatch) {
    return { sourceType: "drive", sourceId: driveMatch[1] };
  }

  const photosMatch = url.match(PHOTOS_ALBUM_RE);
  if (photosMatch) {
    return { sourceType: "photos", sourceId: photosMatch[1] };
  }

  if (PHOTOS_SHORT_RE.test(url)) {
    const resolved = await resolveShortLink(url);
    const resolvedMatch = resolved.match(PHOTOS_ALBUM_RE);
    if (resolvedMatch) {
      return { sourceType: "photos", sourceId: resolvedMatch[1] };
    }
  }

  throw new InvalidLinkError();
}

async function resolveShortLink(url: string): Promise<string> {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  return res.url;
}
