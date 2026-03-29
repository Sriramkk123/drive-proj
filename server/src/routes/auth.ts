import type { FastifyInstance } from "fastify";
import { google } from "googleapis";
import type { Config } from "../config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/photoslibrary.readonly",
  "https://www.googleapis.com/auth/photoslibrary.appendonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export default async function authRoutes(app: FastifyInstance, opts: { config: Config }) {
  const { config } = opts;

  function createOAuth2Client() {
    return new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri,
    );
  }

  app.get("/v1/auth/status", async (request, reply) => {
    if (!request.accessToken) {
      return reply.status(401).send({
        error: "unauthenticated",
        message: "Not authenticated. Redirect to /v1/auth/google.",
        details: [],
      });
    }

    const oauth2 = createOAuth2Client();
    oauth2.setCredentials({ access_token: request.accessToken });
    try {
      const oauth2Service = google.oauth2({ version: "v2", auth: oauth2 });
      const { data } = await oauth2Service.userinfo.get();
      return { authenticated: true, email: data.email };
    } catch {
      reply.clearCookie("access_token");
      return reply.status(401).send({
        error: "unauthenticated",
        message: "Token expired. Re-authenticate.",
        details: [],
      });
    }
  });

  app.get("/v1/auth/google", async (_request, reply) => {
    const oauth2 = createOAuth2Client();
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    return reply.redirect(url);
  });

  app.get("/v1/auth/google/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.status(400).send({
        error: "invalid_link",
        message: "Missing authorization code.",
        details: [],
      });
    }

    const oauth2 = createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);

    reply.setCookie("access_token", tokens.access_token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });

    return reply.redirect(config.frontendUrl);
  });
}
