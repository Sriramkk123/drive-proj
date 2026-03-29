import { randomUUID } from "node:crypto";
import type { Collection, MediaItem, SourceType } from "../types.js";

interface CreateParams {
  sourceType: SourceType;
  sourceId: string;
  name: string;
  accessToken: string;
}

interface MediaLookupResult {
  media: MediaItem;
  accessToken: string;
}

export class CollectionStore {
  private collections = new Map<string, Collection>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private ttlMs: number) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
  }

  create(params: CreateParams): Collection {
    const now = new Date();
    const collection: Collection = {
      id: randomUUID(),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      name: params.name,
      status: "fetching",
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      media: [],
      accessToken: params.accessToken,
    };
    this.collections.set(collection.id, collection);
    return collection;
  }

  get(id: string): Collection | undefined {
    const collection = this.collections.get(id);
    if (!collection) return undefined;
    if (new Date() > collection.expiresAt) {
      this.collections.delete(id);
      return undefined;
    }
    return collection;
  }

  update(id: string, updates: Partial<Pick<Collection, "status" | "media" | "name">>): void {
    const collection = this.get(id);
    if (!collection) return;
    Object.assign(collection, updates);
  }

  findMediaById(mediaId: string): MediaLookupResult | undefined {
    for (const collection of this.collections.values()) {
      if (new Date() > collection.expiresAt) continue;
      const media = collection.media.find((m) => m.id === mediaId);
      if (media) {
        return { media, accessToken: collection.accessToken };
      }
    }
    return undefined;
  }

  private cleanup(): void {
    const now = new Date();
    for (const [id, collection] of this.collections) {
      if (now > collection.expiresAt) {
        this.collections.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
