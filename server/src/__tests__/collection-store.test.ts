import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CollectionStore } from "../services/collection-store.js";

describe("CollectionStore", () => {
  let store: CollectionStore;

  beforeEach(() => {
    store = new CollectionStore(60_000);
  });

  afterEach(() => {
    store.destroy();
  });

  it("creates and retrieves a collection", () => {
    const collection = store.create({
      sourceType: "drive",
      sourceId: "folder123",
      name: "Test Folder",
      accessToken: "token",
    });
    expect(collection.id).toBeDefined();
    expect(collection.status).toBe("fetching");
    expect(collection.media).toEqual([]);
    const found = store.get(collection.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(collection.id);
  });

  it("returns undefined for unknown ID", () => {
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("updates collection status and media", () => {
    const collection = store.create({
      sourceType: "drive",
      sourceId: "folder123",
      name: "Test",
      accessToken: "token",
    });
    store.update(collection.id, {
      status: "ready",
      media: [{
        id: "m1", name: "photo.jpg", mimeType: "image/jpeg",
        thumbnailUrl: "https://example.com/thumb", sourceFileId: "gf1",
        width: 100, height: 100,
      }],
    });
    const updated = store.get(collection.id);
    expect(updated!.status).toBe("ready");
    expect(updated!.media).toHaveLength(1);
  });

  it("finds media item by ID across collections", () => {
    const collection = store.create({
      sourceType: "drive", sourceId: "f1", name: "Test", accessToken: "token",
    });
    store.update(collection.id, {
      status: "ready",
      media: [{
        id: "media-1", name: "photo.jpg", mimeType: "image/jpeg",
        thumbnailUrl: "https://example.com/thumb", sourceFileId: "gf1",
        width: 100, height: 100,
      }],
    });
    const result = store.findMediaById("media-1");
    expect(result).toBeDefined();
    expect(result!.media.id).toBe("media-1");
    expect(result!.accessToken).toBe("token");
  });

  it("returns undefined for unknown media ID", () => {
    expect(store.findMediaById("nope")).toBeUndefined();
  });

  it("expires collections after TTL", () => {
    vi.useFakeTimers();
    const shortStore = new CollectionStore(100);
    const collection = shortStore.create({
      sourceType: "drive", sourceId: "f1", name: "Test", accessToken: "token",
    });
    expect(shortStore.get(collection.id)).toBeDefined();
    vi.advanceTimersByTime(200);
    expect(shortStore.get(collection.id)).toBeUndefined();
    shortStore.destroy();
    vi.useRealTimers();
  });
});
