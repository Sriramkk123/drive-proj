import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { CollectionStore } from "../services/collection-store.js";
import { NotFoundError } from "../errors.js";

export default async function mediaRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.get("/v1/media/:mediaId/thumbnail", async (request, reply) => {
    requireAuth(request);
    const { mediaId } = request.params as { mediaId: string };
    const result = store.findMediaById(mediaId);
    if (!result) throw new NotFoundError("Media");

    const { media } = result;
    const response = await fetch(media.thumbnailUrl, {
      headers: { Authorization: `Bearer ${request.accessToken}` },
    });

    if (!response.ok) {
      throw new NotFoundError("Thumbnail");
    }

    reply.header("Content-Type", response.headers.get("content-type") ?? "image/jpeg");
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(Buffer.from(await response.arrayBuffer()));
  });
}
