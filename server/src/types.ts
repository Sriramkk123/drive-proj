export type SourceType = "drive" | "photos";
export type CollectionStatus = "fetching" | "ready" | "failed";

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  sourceFileId: string;
  width: number;
  height: number;
}

export interface Collection {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  name: string;
  status: CollectionStatus;
  createdAt: Date;
  expiresAt: Date;
  media: MediaItem[];
  accessToken: string;
}

export interface ExportRecord {
  id: string;
  collectionId: string;
  name: string;
  link: string;
  sourceType: SourceType;
  itemCount: number;
  createdAt: Date;
}

export interface ErrorEnvelope {
  error: string;
  message: string;
  details: unknown[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}
