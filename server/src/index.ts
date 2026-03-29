import "dotenv/config";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { DomainError } from "./errors.js";
import type { ErrorEnvelope } from "./types.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import collectionRoutes from "./routes/collections.js";
import mediaRoutes from "./routes/media.js";
import exportRoutes from "./routes/exports.js";
import photosPickerRoutes from "./routes/photos-picker.js";
import { CollectionStore } from "./services/collection-store.js";

const config = loadConfig();

const isDev = process.env.NODE_ENV !== "production";

const app = Fastify({
  logger: {
    level: "info",
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
      },
    }),
  },
});

await app.register(fastifyCookie, { secret: config.sessionSecret });
await app.register(fastifyCors, {
  origin: config.frontendUrl,
  credentials: true,
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof DomainError) {
    const envelope: ErrorEnvelope = {
      error: error.code,
      message: error.message,
      details: error.details,
    };
    return reply.status(error.statusCode).send(envelope);
  }

  app.log.error(error);
  const envelope: ErrorEnvelope = {
    error: "internal_error",
    message: "An unexpected error occurred.",
    details: [],
  };
  return reply.status(500).send(envelope);
});

await app.register(authPlugin);
await app.register(authRoutes, { config });

const collectionStore = new CollectionStore(config.collectionTtlMs);
await app.register(collectionRoutes, { store: collectionStore });
await app.register(mediaRoutes, { store: collectionStore });
await app.register(exportRoutes, { store: collectionStore });
await app.register(photosPickerRoutes, { store: collectionStore });

await app.listen({ port: config.port, host: "0.0.0.0" });
app.log.info(`Server running on port ${config.port}`);
