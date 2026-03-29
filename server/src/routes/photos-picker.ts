import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { CollectionStore } from "../services/collection-store.js";
import {
  createPickerSession,
  getPickerSession,
  listPickerMediaItems,
  deletePickerSession,
} from "../services/google-photos-picker.js";
import { NotFoundError } from "../errors.js";

export default async function photosPickerRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  // Create a picker session and a collection for it
  app.post("/v1/photos/sessions", async (request, reply) => {
    requireAuth(request);

    const session = await createPickerSession(request.accessToken);

    // Create a collection that will be populated once user picks photos
    const collection = store.create({
      sourceType: "photos",
      sourceId: session.id,
      name: "Google Photos Selection",
      accessToken: request.accessToken,
    });

    return reply.status(201).send({
      collectionId: collection.id,
      sessionId: session.id,
      pickerUri: session.pickerUri,
    });
  });

  // Poll picker session status + fetch media when ready
  app.get("/v1/photos/sessions/:sessionId", async (request) => {
    requireAuth(request);
    const { sessionId } = request.params as { sessionId: string };

    const session = await getPickerSession(request.accessToken, sessionId);

    return {
      sessionId: session.id,
      mediaItemsSet: session.mediaItemsSet,
      expireTime: session.expireTime,
    };
  });

  // Finalize: fetch picked media items into the collection
  app.post("/v1/photos/sessions/:sessionId/finalize", {
    schema: {
      body: {
        type: "object",
        required: ["collectionId"],
        properties: { collectionId: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    requireAuth(request);
    const { sessionId } = request.params as { sessionId: string };
    const { collectionId } = request.body as { collectionId: string };

    const collection = store.get(collectionId);
    if (!collection) throw new NotFoundError("Collection");

    const media = await listPickerMediaItems(request.accessToken, sessionId);
    store.update(collectionId, {
      status: "ready",
      media,
      name: `Google Photos (${media.length} items)`,
    });

    // Clean up the picker session
    try {
      await deletePickerSession(request.accessToken, sessionId);
    } catch {
      // Non-critical, session will expire on its own
    }

    return reply.send({
      collectionId,
      mediaCount: media.length,
    });
  });
}
