import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { UnauthenticatedError } from "../errors.js";

declare module "fastify" {
  interface FastifyRequest {
    accessToken: string;
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("accessToken", "");

  app.addHook("onRequest", async (request: FastifyRequest) => {
    const token = request.cookies.access_token;
    if (token) {
      request.accessToken = token;
    }
  });
});

export function requireAuth(request: FastifyRequest): void {
  if (!request.accessToken) {
    throw new UnauthenticatedError();
  }
}
