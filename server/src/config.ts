export interface Config {
  port: number;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  sessionSecret: string;
  frontendUrl: string;
  collectionTtlMs: number;
}

export function loadConfig(): Config {
  const required = (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
  };

  return {
    port: parseInt(process.env.PORT ?? "3001", 10),
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: required("GOOGLE_REDIRECT_URI"),
    sessionSecret: required("SESSION_SECRET"),
    frontendUrl: required("FRONTEND_URL"),
    collectionTtlMs: parseInt(process.env.COLLECTION_TTL_MS ?? "3600000", 10),
  };
}
