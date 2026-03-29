import { InvalidLinkError } from "../errors.js";
import type { SourceType } from "../types.js";

export interface ParsedLink {
  sourceType: SourceType;
  sourceId: string;
}

const DRIVE_FOLDER_RE = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/;
const PHOTOS_ALBUM_RE = /photos\.google\.com\/(?:share|album)\/([a-zA-Z0-9_-]+)/;

export function parseGoogleLink(url: string): ParsedLink {
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

  throw new InvalidLinkError();
}
