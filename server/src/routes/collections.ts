import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { parseGoogleLink } from "../services/link-parser.js";
import { CollectionStore } from "../services/collection-store.js";
import { getFolderName, listDriveMedia } from "../services/google-drive.js";
import { getAlbumName, listPhotosMedia } from "../services/google-photos.js";
import { NotFoundError, CollectionNotReadyError, DomainError } from "../errors.js";

export default async function collectionRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.post("/v1/collections", {
    schema: {
      body: {
        type: "object",
        required: ["link"],
        properties: { link: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    requireAuth(request);
    const { link } = request.body as { link: string };
    const parsed = await parseGoogleLink(link);

    if (parsed.sourceType === "photos") {
      throw new DomainError(
        "photos_unsupported",
        "Google Photos is not supported yet. Google deprecated the Photos Library API for new projects. Please use a Google Drive folder link instead.",
        400,
      );
    }

    const name = await getFolderName(request.accessToken, parsed.sourceId);

    const collection = store.create({
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      name,
      accessToken: request.accessToken,
    });

    fetchMediaInBackground(collection.id, parsed, request.accessToken, store, app);

    return reply.status(201).send({
      id: collection.id,
      sourceType: collection.sourceType,
      name: collection.name,
      status: collection.status,
    });
  });

  app.get("/v1/collections/:id", async (request) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    const collection = store.get(id);
    if (!collection) throw new NotFoundError("Collection");

    return {
      id: collection.id,
      sourceType: collection.sourceType,
      name: collection.name,
      status: collection.status,
      mediaCount: collection.media.length,
      createdAt: collection.createdAt.toISOString(),
      expiresAt: collection.expiresAt.toISOString(),
    };
  });

  app.get("/v1/collections/:id/media", async (request) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    const query = request.query as {
      page?: string; limit?: string; sort?: string; order?: string;
    };

    const collection = store.get(id);
    if (!collection) throw new NotFoundError("Collection");
    if (collection.status !== "ready") throw new CollectionNotReadyError();

    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10)));
    const sort = query.sort === "created_at" ? "created_at" : "name";
    const order = query.order === "desc" ? "desc" : "asc";

    const sorted = [...collection.media];
    if (sort === "name") {
      sorted.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name);
        return order === "asc" ? cmp : -cmp;
      });
    } else if (sort === "created_at" && order === "desc") {
      sorted.reverse();
    }

    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit).map((m) => ({
      id: m.id,
      name: m.name,
      mimeType: m.mimeType,
      thumbnailUrl: `/v1/media/${m.id}/thumbnail`,
      width: m.width,
      height: m.height,
    }));

    return {
      items, page, limit,
      total: collection.media.length,
      hasNext: start + limit < collection.media.length,
    };
  });
}

function fetchMediaInBackground(
  collectionId: string,
  parsed: { sourceType: "drive" | "photos"; sourceId: string },
  accessToken: string,
  store: CollectionStore,
  app: FastifyInstance,
): void {
  const work = async () => {
    try {
      let media;
      if (parsed.sourceType === "drive") {
        media = await listDriveMedia(accessToken, parsed.sourceId);
      } else {
        media = await listPhotosMedia(accessToken, parsed.sourceId);
      }
      store.update(collectionId, { status: "ready", media });
    } catch (err) {
      app.log.error(err, "Failed to fetch media for collection %s", collectionId);
      store.update(collectionId, { status: "failed" });
    }
  };
  work();
}
