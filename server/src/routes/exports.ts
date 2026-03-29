import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { CollectionStore } from "../services/collection-store.js";
import { NotFoundError, CollectionNotReadyError } from "../errors.js";
import {
  createDriveFolder,
  copyFilesToFolder,
  uploadFileToDriveFromUrl,
} from "../services/google-drive.js";

export default async function exportRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.post("/v1/collections/:id/exports", {
    schema: {
      body: {
        type: "object",
        required: ["name", "mediaIds"],
        properties: {
          name: { type: "string", minLength: 1 },
          mediaIds: { type: "array", items: { type: "string" }, minItems: 1 },
        },
      },
    },
  }, async (request, reply) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    const { name, mediaIds } = request.body as { name: string; mediaIds: string[] };

    const collection = store.get(id);
    if (!collection) throw new NotFoundError("Collection");
    if (collection.status !== "ready") throw new CollectionNotReadyError();

    const selectedMedia = collection.media.filter((m) => mediaIds.includes(m.id));
    const folderId = await createDriveFolder(request.accessToken, name);

    if (collection.sourceType === "drive") {
      const sourceFileIds = selectedMedia.map((m) => m.sourceFileId);
      await copyFilesToFolder(request.accessToken, sourceFileIds, folderId);
    } else {
      // Photos: download from baseUrl and upload to Drive
      for (const media of selectedMedia) {
        // Use full-resolution URL (append =d for download)
        const downloadUrl = media.thumbnailUrl.replace(/=w\d+-h\d+$/, "=d");
        await uploadFileToDriveFromUrl(
          request.accessToken,
          downloadUrl,
          media.name,
          media.mimeType,
          folderId,
        );
      }
    }

    const link = `https://drive.google.com/drive/folders/${folderId}`;

    return reply.status(201).send({
      id: randomUUID(),
      name,
      link,
      sourceType: "drive",
      itemCount: selectedMedia.length,
    });
  });
}
