import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { CollectionStore } from "../services/collection-store.js";
import { NotFoundError, CollectionNotReadyError } from "../errors.js";
import { createDriveFolder, copyFilesToFolder } from "../services/google-drive.js";
import { createPhotosAlbum, addItemsToAlbum } from "../services/google-photos.js";

export default async function exportRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.post("/v1/collections/:id/exports", async (request, reply) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    const { name, mediaIds } = request.body as { name: string; mediaIds: string[] };

    const collection = store.get(id);
    if (!collection) throw new NotFoundError("Collection");
    if (collection.status !== "ready") throw new CollectionNotReadyError();

    const selectedMedia = collection.media.filter((m) => mediaIds.includes(m.id));
    let link: string;

    if (collection.sourceType === "drive") {
      const folderId = await createDriveFolder(request.accessToken, name);
      const sourceFileIds = selectedMedia.map((m) => m.sourceFileId);
      await copyFilesToFolder(request.accessToken, sourceFileIds, folderId);
      link = `https://drive.google.com/drive/folders/${folderId}`;
    } else {
      const albumId = await createPhotosAlbum(request.accessToken, name);
      const sourceMediaIds = selectedMedia.map((m) => m.sourceFileId);
      await addItemsToAlbum(request.accessToken, albumId, sourceMediaIds);
      link = `https://photos.google.com/album/${albumId}`;
    }

    return reply.status(201).send({
      id: randomUUID(),
      name,
      link,
      sourceType: collection.sourceType,
      itemCount: selectedMedia.length,
    });
  });
}
