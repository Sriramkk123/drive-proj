# DrivePick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that lets users paste a Google Drive/Photos link, view media in a grid, select items, and create a new folder/album with the selected items.

**Architecture:** Monorepo with `server/` (Fastify + TypeScript) and `web/` (React + Vite + shadcn/ui). Backend handles all Google API communication, proxies thumbnails, and manages in-memory collections with TTL. Frontend is a dark-themed SPA with three routes.

**Tech Stack:** Fastify, React, Vite, TypeScript, shadcn/ui, TanStack Query, Zustand, React Router, Google Drive API v3, Google Photos Library API, Docker

**Spec:** `docs/superpowers/specs/2026-03-29-drivepick-design.md`

---

## File Structure

### Backend (`server/`)

```
server/
  package.json
  tsconfig.json
  .env.example
  src/
    index.ts                          # Fastify server entrypoint, plugin registration
    config.ts                         # Env var loading and validation
    types.ts                          # Shared types: Collection, MediaItem, Export, error codes
    errors.ts                         # Domain error classes (InvalidLink, NotFound, CollectionNotReady)
    plugins/
      auth.ts                         # Fastify plugin: cookie parsing, auth decorator, guard hook
    routes/
      auth.ts                         # GET /v1/auth/status, /google, /google/callback
      collections.ts                  # POST /v1/collections, GET /:id, GET /:id/media
      media.ts                        # GET /v1/media/:mediaId/thumbnail
      exports.ts                      # POST /v1/collections/:id/exports
    services/
      link-parser.ts                  # Parse Google Drive/Photos URLs, extract source type + ID
      collection-store.ts             # In-memory Map<string, Collection> with TTL expiry
      google-drive.ts                 # Drive API: list files, get folder name, copy files, create folder
      google-photos.ts                # Photos API: list media, get album name, create album, add items
      thumbnail-proxy.ts              # Lookup media across collections, stream thumbnail from Google
    __tests__/
      link-parser.test.ts
      collection-store.test.ts
      routes/
        auth.test.ts
        collections.test.ts
        media.test.ts
        exports.test.ts
```

### Frontend (`web/`)

```
web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx                          # React entrypoint
    App.tsx                           # Router setup, dark theme provider
    api/
      client.ts                       # Fetch wrapper with error handling
      collections.ts                  # TanStack Query hooks: useCreateCollection, useCollection, useCollectionMedia
      auth.ts                         # TanStack Query hooks: useAuthStatus
      exports.ts                      # TanStack Query hooks: useCreateExport
    stores/
      selection.ts                    # Zustand store: selected media IDs Set, toggle, selectAll, deselectAll
    pages/
      LinkInputPage.tsx               # Paste link, load button, auth redirect
      GalleryPage.tsx                 # Top bar + photo grid, uses selection store
      ResultPage.tsx                  # Success card with link
    components/
      MediaGrid.tsx                   # 4-column grid of MediaCard components
      MediaCard.tsx                   # Single thumbnail with select/deselect overlay
      NameAlbumModal.tsx              # Modal dialog for album naming
      TopBar.tsx                      # Breadcrumb, count badge, Select All, Create Album btn
```

### Root

```
docker-compose.yml
Dockerfile.server
Dockerfile.web
.env.example
```

---

## Task 1: Project Scaffolding and Tooling

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/.env.example`
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`
- Create: `docker-compose.yml`, `Dockerfile.server`, `Dockerfile.web`, `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/sriramkk/personal/drive-proj
git init
```

- [ ] **Step 2: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 3: Scaffold server package**

```bash
mkdir -p server/src/{plugins,routes,services,__tests__/routes}
```

Create `server/package.json`:

```json
{
  "name": "drivepick-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ --ext .ts"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Install server dependencies**

```bash
cd /Users/sriramkk/personal/drive-proj/server
pnpm init
pnpm add fastify @fastify/cookie @fastify/cors googleapis
pnpm add -D typescript tsx vitest @types/node eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

- [ ] **Step 5: Create server .env.example**

Create `server/.env.example`:

```env
PORT=3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/v1/auth/google/callback
SESSION_SECRET=change-me-to-a-random-string
FRONTEND_URL=http://localhost:5173
COLLECTION_TTL_MS=3600000
```

- [ ] **Step 6: Scaffold web package**

```bash
cd /Users/sriramkk/personal/drive-proj
pnpm create vite web --template react-ts
cd web
pnpm add react-router-dom @tanstack/react-query zustand
pnpm add -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 7: Configure Vite with Tailwind and API proxy**

Update `web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
});
```

Create `web/src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: Set up shadcn/ui**

```bash
cd /Users/sriramkk/personal/drive-proj/web
pnpm dlx shadcn@latest init
```

Select: TypeScript, default style, slate base color, CSS variables. Then add components:

```bash
pnpm dlx shadcn@latest add button input dialog badge
```

- [ ] **Step 9: Configure dark theme CSS**

Update `web/src/index.css`:

```css
@import "tailwindcss";

:root {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 10.2%;
  --card-foreground: 0 0% 98%;
  --primary: 204 64% 57%;
  --primary-foreground: 0 0% 100%;
  --muted: 0 0% 40%;
  --muted-foreground: 0 0% 53.3%;
  --border: 0 0% 20%;
  --input: 0 0% 20%;
  --ring: 204 64% 57%;
  --radius: 0.5rem;
}

body {
  @apply bg-background text-foreground;
}
```

- [ ] **Step 10: Create Docker files**

Create `Dockerfile.server`:

```dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY server/ .
RUN pnpm build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

Create `Dockerfile.web`:

```dockerfile
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Create `web/nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /v1/ {
        proxy_pass http://server:3001;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Create `docker-compose.yml`:

```yaml
services:
  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports:
      - "3001:3001"
    env_file:
      - .env

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "8080:80"
    depends_on:
      - server
```

Create `.env.example` (root):

```env
PORT=3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/v1/auth/google/callback
SESSION_SECRET=change-me-to-a-random-string
FRONTEND_URL=http://localhost:5173
COLLECTION_TTL_MS=3600000
```

- [ ] **Step 11: Verify both projects compile**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm tsc --noEmit
cd /Users/sriramkk/personal/drive-proj/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "Sriram | Scaffold monorepo with server and web packages"
```

---

## Task 2: Shared Types, Config, and Error Handling (Backend)

**Files:**
- Create: `server/src/types.ts`
- Create: `server/src/config.ts`
- Create: `server/src/errors.ts`

- [ ] **Step 1: Create shared types**

Create `server/src/types.ts`:

```typescript
export type SourceType = "drive" | "photos";
export type CollectionStatus = "fetching" | "ready" | "failed";

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  sourceFileId: string;
  width: number;
  height: number;
}

export interface Collection {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  name: string;
  status: CollectionStatus;
  createdAt: Date;
  expiresAt: Date;
  media: MediaItem[];
  accessToken: string;
}

export interface ExportRecord {
  id: string;
  collectionId: string;
  name: string;
  link: string;
  sourceType: SourceType;
  itemCount: number;
  createdAt: Date;
}

export interface ErrorEnvelope {
  error: string;
  message: string;
  details: unknown[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}
```

- [ ] **Step 2: Create config loader**

Create `server/src/config.ts`:

```typescript
import { FastifyBaseLogger } from "fastify";

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
```

- [ ] **Step 3: Create domain error classes**

Create `server/src/errors.ts`:

```typescript
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvalidLinkError extends DomainError {
  constructor(message = "The provided URL is not a valid Google Drive or Photos link.") {
    super("invalid_link", message, 400);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super("not_found", `${resource} not found.`, 404);
  }
}

export class CollectionNotReadyError extends DomainError {
  constructor() {
    super("collection_not_ready", "Collection is still being fetched.", 409);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor() {
    super("unauthenticated", "Not authenticated. Redirect to /v1/auth/google.", 401);
  }
}

export class ExportFailedError extends DomainError {
  constructor(message = "Failed to create album in Google.") {
    super("export_failed", message, 500);
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/types.ts server/src/config.ts server/src/errors.ts
git commit -m "Sriram | Add shared types, config loader, and domain errors"
```

---

## Task 3: Fastify Server Entrypoint with Error Handler

**Files:**
- Create: `server/src/index.ts`

- [ ] **Step 1: Create server entrypoint**

Create `server/src/index.ts`:

```typescript
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { DomainError } from "./errors.js";
import type { ErrorEnvelope } from "./types.js";

const config = loadConfig();

const app = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
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

// Routes will be registered here in later tasks

await app.listen({ port: config.port, host: "0.0.0.0" });
app.log.info(`Server running on port ${config.port}`);
```

- [ ] **Step 2: Add pino-pretty dev dependency**

```bash
cd /Users/sriramkk/personal/drive-proj/server
pnpm add -D pino-pretty
```

- [ ] **Step 3: Verify server starts (will fail on missing env vars -- that's expected)**

Create a temporary `server/.env` for local dev:

```bash
cp server/.env.example server/.env
```

Fill in dummy values for `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `FRONTEND_URL` in `server/.env`.

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm dev
```

Expected: Server starts on port 3001. Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/index.ts server/package.json server/pnpm-lock.yaml
git commit -m "Sriram | Add Fastify server entrypoint with global error handler"
```

---

## Task 4: Link Parser Service

**Files:**
- Create: `server/src/services/link-parser.ts`
- Create: `server/src/__tests__/link-parser.test.ts`

- [ ] **Step 1: Write failing tests for link parser**

Create `server/src/__tests__/link-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseGoogleLink } from "../services/link-parser.js";

describe("parseGoogleLink", () => {
  it("parses a standard Drive folder URL", () => {
    const result = parseGoogleLink(
      "https://drive.google.com/drive/folders/1abc123xyz"
    );
    expect(result).toEqual({ sourceType: "drive", sourceId: "1abc123xyz" });
  });

  it("parses a Drive folder URL with query params", () => {
    const result = parseGoogleLink(
      "https://drive.google.com/drive/folders/1abc123xyz?usp=sharing"
    );
    expect(result).toEqual({ sourceType: "drive", sourceId: "1abc123xyz" });
  });

  it("parses a Drive folder URL with /u/0/ prefix", () => {
    const result = parseGoogleLink(
      "https://drive.google.com/drive/u/0/folders/1abc123xyz"
    );
    expect(result).toEqual({ sourceType: "drive", sourceId: "1abc123xyz" });
  });

  it("parses a Google Photos shared album URL", () => {
    const result = parseGoogleLink(
      "https://photos.google.com/share/AF1QipN_abc123"
    );
    expect(result).toEqual({ sourceType: "photos", sourceId: "AF1QipN_abc123" });
  });

  it("parses a Google Photos album URL", () => {
    const result = parseGoogleLink(
      "https://photos.google.com/album/AF1QipN_abc123"
    );
    expect(result).toEqual({ sourceType: "photos", sourceId: "AF1QipN_abc123" });
  });

  it("throws InvalidLinkError for unrecognized URLs", () => {
    expect(() => parseGoogleLink("https://example.com/foo")).toThrow(
      "not a valid Google Drive or Photos link"
    );
  });

  it("throws InvalidLinkError for empty string", () => {
    expect(() => parseGoogleLink("")).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm vitest run src/__tests__/link-parser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement link parser**

Create `server/src/services/link-parser.ts`:

```typescript
import { InvalidLinkError } from "../errors.js";
import type { SourceType } from "../types.js";

export interface ParsedLink {
  sourceType: SourceType;
  sourceId: string;
}

const DRIVE_FOLDER_RE = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/;
const PHOTOS_ALBUM_RE = /photos\.google\.com\/(?:share|album)\/([a-zA-Z0-9_-]+)/;

export function parseGoogleLink(url: string): ParsedLink {
  if (!url) {
    throw new InvalidLinkError();
  }

  const driveMatch = url.match(DRIVE_FOLDER_RE);
  if (driveMatch) {
    return { sourceType: "drive", sourceId: driveMatch[1] };
  }

  const photosMatch = url.match(PHOTOS_ALBUM_RE);
  if (photosMatch) {
    return { sourceType: "photos", sourceId: photosMatch[1] };
  }

  throw new InvalidLinkError();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm vitest run src/__tests__/link-parser.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/services/link-parser.ts server/src/__tests__/link-parser.test.ts
git commit -m "Sriram | Add Google link parser with Drive and Photos URL support"
```

---

## Task 5: Collection Store Service

**Files:**
- Create: `server/src/services/collection-store.ts`
- Create: `server/src/__tests__/collection-store.test.ts`

- [ ] **Step 1: Write failing tests for collection store**

Create `server/src/__tests__/collection-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CollectionStore } from "../services/collection-store.js";

describe("CollectionStore", () => {
  let store: CollectionStore;

  beforeEach(() => {
    store = new CollectionStore(60_000); // 1 minute TTL
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
      media: [
        {
          id: "m1",
          name: "photo.jpg",
          mimeType: "image/jpeg",
          thumbnailUrl: "https://example.com/thumb",
          sourceFileId: "gf1",
          width: 100,
          height: 100,
        },
      ],
    });

    const updated = store.get(collection.id);
    expect(updated!.status).toBe("ready");
    expect(updated!.media).toHaveLength(1);
  });

  it("finds media item by ID across collections", () => {
    const collection = store.create({
      sourceType: "drive",
      sourceId: "f1",
      name: "Test",
      accessToken: "token",
    });
    store.update(collection.id, {
      status: "ready",
      media: [
        {
          id: "media-1",
          name: "photo.jpg",
          mimeType: "image/jpeg",
          thumbnailUrl: "https://example.com/thumb",
          sourceFileId: "gf1",
          width: 100,
          height: 100,
        },
      ],
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
    const shortStore = new CollectionStore(100); // 100ms TTL
    const collection = shortStore.create({
      sourceType: "drive",
      sourceId: "f1",
      name: "Test",
      accessToken: "token",
    });

    expect(shortStore.get(collection.id)).toBeDefined();

    vi.advanceTimersByTime(200);

    expect(shortStore.get(collection.id)).toBeUndefined();
    shortStore.destroy();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm vitest run src/__tests__/collection-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement collection store**

Create `server/src/services/collection-store.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { Collection, MediaItem, SourceType } from "../types.js";

interface CreateParams {
  sourceType: SourceType;
  sourceId: string;
  name: string;
  accessToken: string;
}

interface MediaLookupResult {
  media: MediaItem;
  accessToken: string;
}

export class CollectionStore {
  private collections = new Map<string, Collection>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private ttlMs: number) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
  }

  create(params: CreateParams): Collection {
    const now = new Date();
    const collection: Collection = {
      id: randomUUID(),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      name: params.name,
      status: "fetching",
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      media: [],
      accessToken: params.accessToken,
    };
    this.collections.set(collection.id, collection);
    return collection;
  }

  get(id: string): Collection | undefined {
    const collection = this.collections.get(id);
    if (!collection) return undefined;
    if (new Date() > collection.expiresAt) {
      this.collections.delete(id);
      return undefined;
    }
    return collection;
  }

  update(id: string, updates: Partial<Pick<Collection, "status" | "media" | "name">>): void {
    const collection = this.get(id);
    if (!collection) return;
    Object.assign(collection, updates);
  }

  findMediaById(mediaId: string): MediaLookupResult | undefined {
    for (const collection of this.collections.values()) {
      if (new Date() > collection.expiresAt) continue;
      const media = collection.media.find((m) => m.id === mediaId);
      if (media) {
        return { media, accessToken: collection.accessToken };
      }
    }
    return undefined;
  }

  private cleanup(): void {
    const now = new Date();
    for (const [id, collection] of this.collections) {
      if (now > collection.expiresAt) {
        this.collections.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm vitest run src/__tests__/collection-store.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/services/collection-store.ts server/src/__tests__/collection-store.test.ts
git commit -m "Sriram | Add in-memory collection store with TTL expiry"
```

---

## Task 6: Google Drive Service

**Files:**
- Create: `server/src/services/google-drive.ts`

- [ ] **Step 1: Implement Google Drive service**

Create `server/src/services/google-drive.ts`:

```typescript
import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import type { MediaItem } from "../types.js";
import { ExportFailedError } from "../errors.js";

function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export async function getFolderName(
  accessToken: string,
  folderId: string,
): Promise<string> {
  const drive = createDriveClient(accessToken);
  const res = await drive.files.get({ fileId: folderId, fields: "name" });
  return res.data.name ?? "Untitled Folder";
}

export async function listDriveMedia(
  accessToken: string,
  folderId: string,
): Promise<MediaItem[]> {
  const drive = createDriveClient(accessToken);
  const items: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, thumbnailLink, imageMediaMetadata)",
      pageSize: 100,
      pageToken,
    });

    for (const file of res.data.files ?? []) {
      items.push({
        id: randomUUID(),
        name: file.name ?? "unknown",
        mimeType: file.mimeType ?? "application/octet-stream",
        thumbnailUrl: file.thumbnailLink ?? "",
        sourceFileId: file.id!,
        width: file.imageMediaMetadata?.width ?? 0,
        height: file.imageMediaMetadata?.height ?? 0,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
): Promise<string> {
  const drive = createDriveClient(accessToken);
  try {
    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    return res.data.id!;
  } catch (err) {
    throw new ExportFailedError(`Failed to create Drive folder: ${(err as Error).message}`);
  }
}

export async function copyFilesToFolder(
  accessToken: string,
  fileIds: string[],
  folderId: string,
): Promise<void> {
  const drive = createDriveClient(accessToken);
  const copyPromises = fileIds.map((fileId) =>
    drive.files.copy({
      fileId,
      requestBody: { parents: [folderId] },
    }),
  );
  try {
    await Promise.all(copyPromises);
  } catch (err) {
    throw new ExportFailedError(`Failed to copy files: ${(err as Error).message}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/services/google-drive.ts
git commit -m "Sriram | Add Google Drive service for listing and copying media"
```

---

## Task 7: Google Photos Service

**Files:**
- Create: `server/src/services/google-photos.ts`

- [ ] **Step 1: Implement Google Photos service**

The Google Photos Library API doesn't have an official Node.js client in `googleapis`, so we use raw HTTP requests.

Create `server/src/services/google-photos.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { MediaItem } from "../types.js";
import { ExportFailedError } from "../errors.js";

const PHOTOS_API = "https://photoslibrary.googleapis.com/v1";

async function photosRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${PHOTOS_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Photos API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function getAlbumName(
  accessToken: string,
  albumId: string,
): Promise<string> {
  const data = (await photosRequest(accessToken, `/albums/${albumId}`)) as {
    title?: string;
  };
  return data.title ?? "Untitled Album";
}

export async function listPhotosMedia(
  accessToken: string,
  albumId: string,
): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      albumId,
      pageSize: 100,
    };
    if (pageToken) body.pageToken = pageToken;

    const data = (await photosRequest(accessToken, "/mediaItems:search", {
      method: "POST",
      body: JSON.stringify(body),
    })) as {
      mediaItems?: Array<{
        id: string;
        filename: string;
        mimeType: string;
        baseUrl: string;
        mediaMetadata?: {
          width?: string;
          height?: string;
        };
      }>;
      nextPageToken?: string;
    };

    for (const item of data.mediaItems ?? []) {
      items.push({
        id: randomUUID(),
        name: item.filename,
        mimeType: item.mimeType,
        thumbnailUrl: `${item.baseUrl}=w400-h400`,
        sourceFileId: item.id,
        width: parseInt(item.mediaMetadata?.width ?? "0", 10),
        height: parseInt(item.mediaMetadata?.height ?? "0", 10),
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export async function createPhotosAlbum(
  accessToken: string,
  name: string,
): Promise<string> {
  try {
    const data = (await photosRequest(accessToken, "/albums", {
      method: "POST",
      body: JSON.stringify({ album: { title: name } }),
    })) as { id: string };
    return data.id;
  } catch (err) {
    throw new ExportFailedError(
      `Failed to create Photos album: ${(err as Error).message}`,
    );
  }
}

export async function addItemsToAlbum(
  accessToken: string,
  albumId: string,
  mediaItemIds: string[],
): Promise<void> {
  try {
    await photosRequest(accessToken, `/albums/${albumId}:batchAddMediaItems`, {
      method: "POST",
      body: JSON.stringify({ mediaItemIds }),
    });
  } catch (err) {
    throw new ExportFailedError(
      `Failed to add items to album: ${(err as Error).message}`,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/services/google-photos.ts
git commit -m "Sriram | Add Google Photos service for listing media and creating albums"
```

---

## Task 8: Auth Plugin and Routes

**Files:**
- Create: `server/src/plugins/auth.ts`
- Create: `server/src/routes/auth.ts`

- [ ] **Step 1: Create auth plugin (cookie-based token storage)**

Create `server/src/plugins/auth.ts`:

```typescript
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
```

- [ ] **Step 2: Install fastify-plugin**

```bash
cd /Users/sriramkk/personal/drive-proj/server
pnpm add fastify-plugin
```

- [ ] **Step 3: Create auth routes**

Create `server/src/routes/auth.ts`:

```typescript
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

export default async function authRoutes(
  app: FastifyInstance,
  opts: { config: Config },
) {
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
```

- [ ] **Step 4: Register auth plugin and routes in index.ts**

Update `server/src/index.ts` -- add these imports at the top:

```typescript
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
```

Add these lines before `await app.listen(...)`:

```typescript
await app.register(authPlugin);
await app.register(authRoutes, { config });
```

- [ ] **Step 5: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/plugins/auth.ts server/src/routes/auth.ts server/src/index.ts server/package.json server/pnpm-lock.yaml
git commit -m "Sriram | Add OAuth plugin and auth routes with cookie-based tokens"
```

---

## Task 9: Collections Routes

**Files:**
- Create: `server/src/routes/collections.ts`

- [ ] **Step 1: Implement collections routes**

Create `server/src/routes/collections.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { parseGoogleLink } from "../services/link-parser.js";
import { CollectionStore } from "../services/collection-store.js";
import { getFolderName, listDriveMedia } from "../services/google-drive.js";
import { getAlbumName, listPhotosMedia } from "../services/google-photos.js";
import { NotFoundError, CollectionNotReadyError } from "../errors.js";

export default async function collectionRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.post("/v1/collections", async (request, reply) => {
    requireAuth(request);
    const { link } = request.body as { link: string };
    const parsed = parseGoogleLink(link);

    // Get folder/album name synchronously, then create collection
    let name: string;
    if (parsed.sourceType === "drive") {
      name = await getFolderName(request.accessToken, parsed.sourceId);
    } else {
      name = await getAlbumName(request.accessToken, parsed.sourceId);
    }

    const collection = store.create({
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      name,
      accessToken: request.accessToken,
    });

    // Fetch media in the background -- do not await
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
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
    };

    const collection = store.get(id);
    if (!collection) throw new NotFoundError("Collection");
    if (collection.status !== "ready") throw new CollectionNotReadyError();

    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10)));
    const sort = query.sort === "created_at" ? "created_at" : "name";
    const order = query.order === "desc" ? "desc" : "asc";

    let sorted = [...collection.media];
    sorted.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return order === "asc" ? cmp : -cmp;
    });

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
      items,
      page,
      limit,
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
```

- [ ] **Step 2: Register in index.ts**

Add import at top of `server/src/index.ts`:

```typescript
import collectionRoutes from "./routes/collections.js";
import { CollectionStore } from "./services/collection-store.js";
```

Add before `await app.listen(...)`:

```typescript
const collectionStore = new CollectionStore(config.collectionTtlMs);
await app.register(collectionRoutes, { store: collectionStore });
```

- [ ] **Step 3: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/routes/collections.ts server/src/index.ts
git commit -m "Sriram | Add collection routes with async media fetching"
```

---

## Task 10: Media Thumbnail Proxy Route

**Files:**
- Create: `server/src/routes/media.ts`

- [ ] **Step 1: Implement thumbnail proxy route**

Create `server/src/routes/media.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { CollectionStore } from "../services/collection-store.js";
import { NotFoundError } from "../errors.js";

export default async function mediaRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.get("/v1/media/:mediaId/thumbnail", async (request, reply) => {
    const { mediaId } = request.params as { mediaId: string };

    const result = store.findMediaById(mediaId);
    if (!result) throw new NotFoundError("Media");

    const { media, accessToken } = result;

    const response = await fetch(media.thumbnailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new NotFoundError("Thumbnail");
    }

    reply.header("Content-Type", response.headers.get("content-type") ?? "image/jpeg");
    reply.header("Cache-Control", "public, max-age=3600");

    return reply.send(Buffer.from(await response.arrayBuffer()));
  });
}
```

- [ ] **Step 2: Register in index.ts**

Add import at top of `server/src/index.ts`:

```typescript
import mediaRoutes from "./routes/media.js";
```

Add after collection routes registration:

```typescript
await app.register(mediaRoutes, { store: collectionStore });
```

- [ ] **Step 3: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/routes/media.ts server/src/index.ts
git commit -m "Sriram | Add thumbnail proxy route with cache headers"
```

---

## Task 11: Exports Route

**Files:**
- Create: `server/src/routes/exports.ts`

- [ ] **Step 1: Implement exports route**

Create `server/src/routes/exports.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { CollectionStore } from "../services/collection-store.js";
import {
  NotFoundError,
  CollectionNotReadyError,
} from "../errors.js";
import {
  createDriveFolder,
  copyFilesToFolder,
} from "../services/google-drive.js";
import {
  createPhotosAlbum,
  addItemsToAlbum,
} from "../services/google-photos.js";

export default async function exportRoutes(
  app: FastifyInstance,
  opts: { store: CollectionStore },
) {
  const { store } = opts;

  app.post("/v1/collections/:id/exports", async (request, reply) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    const { name, mediaIds } = request.body as {
      name: string;
      mediaIds: string[];
    };

    const collection = store.get(id);
    if (!collection) throw new NotFoundError("Collection");
    if (collection.status !== "ready") throw new CollectionNotReadyError();

    const selectedMedia = collection.media.filter((m) =>
      mediaIds.includes(m.id),
    );

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

    const exportRecord = {
      id: randomUUID(),
      name,
      link,
      sourceType: collection.sourceType,
      itemCount: selectedMedia.length,
    };

    return reply.status(201).send(exportRecord);
  });
}
```

- [ ] **Step 2: Register in index.ts**

Add import at top of `server/src/index.ts`:

```typescript
import exportRoutes from "./routes/exports.js";
```

Add after media routes registration:

```typescript
await app.register(exportRoutes, { store: collectionStore });
```

- [ ] **Step 3: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/src/routes/exports.ts server/src/index.ts
git commit -m "Sriram | Add exports route for creating Drive folders and Photos albums"
```

---

## Task 12: Frontend API Client and Query Hooks

**Files:**
- Create: `web/src/api/client.ts`
- Create: `web/src/api/auth.ts`
- Create: `web/src/api/collections.ts`
- Create: `web/src/api/exports.ts`

- [ ] **Step 1: Create fetch wrapper**

Create `web/src/api/client.ts`:

```typescript
export interface ApiError {
  error: string;
  message: string;
  details: unknown[];
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json()) as ApiError;
    throw new ApiRequestError(res.status, body);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Create auth hooks**

Create `web/src/api/auth.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiRequestError } from "./client";

interface AuthStatus {
  authenticated: boolean;
  email: string;
}

export function useAuthStatus() {
  return useQuery<AuthStatus>({
    queryKey: ["auth", "status"],
    queryFn: () => apiFetch<AuthStatus>("/v1/auth/status"),
    retry: false,
  });
}

export function redirectToLogin() {
  window.location.href = "/v1/auth/google";
}
```

- [ ] **Step 3: Create collections hooks**

Create `web/src/api/collections.ts`:

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface CollectionResponse {
  id: string;
  sourceType: "drive" | "photos";
  name: string;
  status: "fetching" | "ready" | "failed";
  mediaCount?: number;
  createdAt?: string;
  expiresAt?: string;
}

interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

interface MediaResponse {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export function useCreateCollection() {
  return useMutation({
    mutationFn: (link: string) =>
      apiFetch<CollectionResponse>("/v1/collections", {
        method: "POST",
        body: JSON.stringify({ link }),
      }),
  });
}

export function useCollection(id: string | undefined) {
  return useQuery<CollectionResponse>({
    queryKey: ["collections", id],
    queryFn: () => apiFetch<CollectionResponse>(`/v1/collections/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "fetching") return 1000;
      return false;
    },
  });
}

export function useCollectionMedia(
  id: string | undefined,
  status: string | undefined,
) {
  return useQuery<MediaResponse>({
    queryKey: ["collections", id, "media"],
    queryFn: () =>
      apiFetch<MediaResponse>(
        `/v1/collections/${id}/media?page=1&limit=100`,
      ),
    enabled: !!id && status === "ready",
  });
}

export type { CollectionResponse, MediaItem, MediaResponse };
```

- [ ] **Step 4: Create exports hooks**

Create `web/src/api/exports.ts`:

```typescript
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface ExportRequest {
  collectionId: string;
  name: string;
  mediaIds: string[];
}

interface ExportResponse {
  id: string;
  name: string;
  link: string;
  sourceType: "drive" | "photos";
  itemCount: number;
}

export function useCreateExport() {
  return useMutation({
    mutationFn: ({ collectionId, name, mediaIds }: ExportRequest) =>
      apiFetch<ExportResponse>(`/v1/collections/${collectionId}/exports`, {
        method: "POST",
        body: JSON.stringify({ name, mediaIds }),
      }),
  });
}

export type { ExportResponse };
```

- [ ] **Step 5: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add web/src/api/
git commit -m "Sriram | Add API client, auth, collections, and exports query hooks"
```

---

## Task 13: Zustand Selection Store

**Files:**
- Create: `web/src/stores/selection.ts`

- [ ] **Step 1: Implement selection store**

Create `web/src/stores/selection.ts`:

```typescript
import { create } from "zustand";

interface SelectionState {
  selected: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  reset: () => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selected: new Set<string>(),

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selected: next };
    }),

  selectAll: (ids) =>
    set(() => ({ selected: new Set(ids) })),

  deselectAll: () =>
    set(() => ({ selected: new Set<string>() })),

  isSelected: (id) => get().selected.has(id),

  reset: () =>
    set(() => ({ selected: new Set<string>() })),
}));
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add web/src/stores/selection.ts
git commit -m "Sriram | Add Zustand selection store for media pick state"
```

---

## Task 14: App Shell, Router, and Link Input Page

**Files:**
- Create: `web/src/App.tsx`
- Modify: `web/src/main.tsx`
- Create: `web/src/pages/LinkInputPage.tsx`

- [ ] **Step 1: Create App shell with router**

Create `web/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinkInputPage } from "./pages/LinkInputPage";
import { GalleryPage } from "./pages/GalleryPage";
import { ResultPage } from "./pages/ResultPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            <Route path="/" element={<LinkInputPage />} />
            <Route path="/collections/:id" element={<GalleryPage />} />
            <Route path="/collections/:id/result" element={<ResultPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Update main.tsx**

Update `web/src/main.tsx`:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Create LinkInputPage**

Create `web/src/pages/LinkInputPage.tsx`:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStatus, redirectToLogin } from "../api/auth";
import { useCreateCollection } from "../api/collections";

export function LinkInputPage() {
  const [link, setLink] = useState("");
  const navigate = useNavigate();
  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const createCollection = useCreateCollection();

  const handleLoad = () => {
    if (!auth?.authenticated) {
      redirectToLogin();
      return;
    }

    createCollection.mutate(link, {
      onSuccess: (data) => {
        navigate(`/collections/${data.id}`);
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-[480px] flex-col items-center gap-6 rounded-2xl bg-card p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">DrivePick</h1>
        <p className="text-center text-sm text-muted-foreground">
          Curate your photos from Google Drive or Photos
        </p>
        <div className="flex w-full gap-3">
          <Input
            placeholder="Paste a Google Drive or Photos link..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            className="flex-1"
          />
          <Button
            onClick={handleLoad}
            disabled={!link.trim() || createCollection.isPending}
          >
            {createCollection.isPending ? "Loading..." : "Load"}
          </Button>
        </div>
        {createCollection.isError && (
          <p className="text-sm text-red-400">
            {createCollection.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder pages for GalleryPage and ResultPage**

Create `web/src/pages/GalleryPage.tsx`:

```typescript
export function GalleryPage() {
  return <div>Gallery (implemented in next task)</div>;
}
```

Create `web/src/pages/ResultPage.tsx`:

```typescript
export function ResultPage() {
  return <div>Result (implemented in next task)</div>;
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd /Users/sriramkk/personal/drive-proj/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add web/src/App.tsx web/src/main.tsx web/src/pages/
git commit -m "Sriram | Add app shell, router, and link input page"
```

---

## Task 15: Gallery Page Components

**Files:**
- Create: `web/src/components/TopBar.tsx`
- Create: `web/src/components/MediaCard.tsx`
- Create: `web/src/components/MediaGrid.tsx`
- Create: `web/src/components/NameAlbumModal.tsx`
- Modify: `web/src/pages/GalleryPage.tsx`

- [ ] **Step 1: Create TopBar component**

Create `web/src/components/TopBar.tsx`:

```typescript
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  collectionName: string;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCreateAlbum: () => void;
  allSelected: boolean;
}

export function TopBar({
  collectionName,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onCreateAlbum,
  allSelected,
}: TopBarProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-border bg-card px-8">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-foreground">DrivePick</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{collectionName}</span>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {selectedCount} of {totalCount} selected
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
        >
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <Button size="sm" onClick={onCreateAlbum} disabled={selectedCount === 0}>
          Create Album
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MediaCard component**

Create `web/src/components/MediaCard.tsx`:

```typescript
import { CheckCircle, Circle, Play } from "lucide-react";

interface MediaCardProps {
  id: string;
  thumbnailUrl: string;
  name: string;
  mimeType: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export function MediaCard({
  id,
  thumbnailUrl,
  name,
  mimeType,
  isSelected,
  onToggle,
}: MediaCardProps) {
  const isVideo = mimeType.startsWith("video/");

  return (
    <button
      onClick={() => onToggle(id)}
      className={`group relative aspect-square overflow-hidden rounded-xl transition-all ${
        isSelected
          ? "ring-3 ring-primary"
          : "opacity-50 hover:opacity-75"
      }`}
    >
      <img
        src={thumbnailUrl}
        alt={name}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute left-3 top-3">
        {isSelected ? (
          <CheckCircle className="h-6 w-6 fill-primary text-white" />
        ) : (
          <Circle className="h-6 w-6 text-white/70" />
        )}
      </div>
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Install lucide-react**

```bash
cd /Users/sriramkk/personal/drive-proj/web
pnpm add lucide-react
```

- [ ] **Step 4: Create MediaGrid component**

Create `web/src/components/MediaGrid.tsx`:

```typescript
import { MediaCard } from "./MediaCard";
import type { MediaItem } from "../api/collections";

interface MediaGridProps {
  items: MediaItem[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
}

export function MediaGrid({ items, isSelected, onToggle }: MediaGridProps) {
  return (
    <div className="grid grid-cols-4 gap-4 p-8">
      {items.map((item) => (
        <MediaCard
          key={item.id}
          id={item.id}
          thumbnailUrl={item.thumbnailUrl}
          name={item.name}
          mimeType={item.mimeType}
          isSelected={isSelected(item.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create NameAlbumModal component**

Create `web/src/components/NameAlbumModal.tsx`:

```typescript
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NameAlbumModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  selectedCount: number;
  defaultName: string;
  isPending: boolean;
}

export function NameAlbumModal({
  open,
  onClose,
  onConfirm,
  selectedCount,
  defaultName,
  isPending,
}: NameAlbumModalProps) {
  const [name, setName] = useState(defaultName);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Name Your Album</DialogTitle>
          <DialogDescription>
            Give a name to your new album with {selectedCount} selected items.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Album name..."
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(name)}
            disabled={!name.trim() || isPending}
          >
            {isPending ? "Creating..." : "Create Album"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Wire up GalleryPage**

Replace `web/src/pages/GalleryPage.tsx`:

```typescript
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCollection, useCollectionMedia } from "../api/collections";
import { useCreateExport } from "../api/exports";
import { useSelectionStore } from "../stores/selection";
import { TopBar } from "../components/TopBar";
import { MediaGrid } from "../components/MediaGrid";
import { NameAlbumModal } from "../components/NameAlbumModal";

export function GalleryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: collection } = useCollection(id);
  const { data: mediaResponse } = useCollectionMedia(id, collection?.status);
  const createExport = useCreateExport();

  const { selected, toggle, selectAll, deselectAll, isSelected } =
    useSelectionStore();

  const items = mediaResponse?.items ?? [];
  const allIds = items.map((i) => i.id);

  const handleCreateAlbum = (name: string) => {
    if (!id) return;
    createExport.mutate(
      { collectionId: id, name, mediaIds: Array.from(selected) },
      {
        onSuccess: (data) => {
          navigate(`/collections/${id}/result`, {
            state: {
              name: data.name,
              link: data.link,
              sourceType: data.sourceType,
              itemCount: data.itemCount,
            },
          });
        },
      },
    );
  };

  if (!collection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (collection.status === "fetching") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Fetching photos from Google...
      </div>
    );
  }

  if (collection.status === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-400">
        Failed to load media. Please try again.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        collectionName={collection.name}
        selectedCount={selected.size}
        totalCount={items.length}
        onSelectAll={() => selectAll(allIds)}
        onDeselectAll={deselectAll}
        onCreateAlbum={() => setModalOpen(true)}
        allSelected={selected.size === items.length && items.length > 0}
      />
      <MediaGrid items={items} isSelected={isSelected} onToggle={toggle} />
      <NameAlbumModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleCreateAlbum}
        selectedCount={selected.size}
        defaultName={`${collection.name} - Best Picks`}
        isPending={createExport.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 7: Verify it compiles**

```bash
cd /Users/sriramkk/personal/drive-proj/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add web/src/components/ web/src/pages/GalleryPage.tsx web/package.json web/pnpm-lock.yaml
git commit -m "Sriram | Add gallery page with grid, selection, and album naming modal"
```

---

## Task 16: Result Page

**Files:**
- Modify: `web/src/pages/ResultPage.tsx`

- [ ] **Step 1: Implement ResultPage**

Replace `web/src/pages/ResultPage.tsx`:

```typescript
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useSelectionStore } from "../stores/selection";

interface ResultState {
  name: string;
  link: string;
  sourceType: "drive" | "photos";
  itemCount: number;
}

export function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const reset = useSelectionStore((s) => s.reset);

  const state = location.state as ResultState | null;

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        No result data. Start over.
      </div>
    );
  }

  const serviceName =
    state.sourceType === "drive" ? "Google Drive" : "Google Photos";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(state.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartOver = () => {
    reset();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-[440px] flex-col items-center gap-6 rounded-2xl bg-card p-12 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Album Created!</h2>
        <p className="text-center text-sm text-muted-foreground">
          {state.itemCount} {state.itemCount === 1 ? "item has" : "items have"}{" "}
          been added to your new {serviceName} folder.
        </p>
        <div className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {state.link}
          </span>
          <button
            onClick={handleCopy}
            className="ml-2 shrink-0 text-sm font-semibold text-primary hover:text-primary/80"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <Button className="w-full" onClick={() => window.open(state.link, "_blank")}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in {serviceName}
        </Button>
        <Button variant="outline" className="w-full" onClick={handleStartOver}>
          Start Over
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/sriramkk/personal/drive-proj/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add web/src/pages/ResultPage.tsx
git commit -m "Sriram | Add result page with copy link, open in Google, and start over"
```

---

## Task 17: ESLint Configuration

**Files:**
- Create: `server/.eslintrc.json`
- Create: `web/.eslintrc.json`

- [ ] **Step 1: Configure server ESLint**

Create `server/.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "error"
  }
}
```

- [ ] **Step 2: Run server lint and fix any issues**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm lint
```

Fix any reported issues.

- [ ] **Step 3: Run web lint (Vite template includes ESLint)**

```bash
cd /Users/sriramkk/personal/drive-proj/web && pnpm lint
```

Fix any reported issues.

- [ ] **Step 4: Commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add server/.eslintrc.json web/
git commit -m "Sriram | Configure ESLint for server and web"
```

---

## Task 18: End-to-End Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start both server and web dev servers**

Terminal 1:
```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm dev
```

Terminal 2:
```bash
cd /Users/sriramkk/personal/drive-proj/web && pnpm dev
```

- [ ] **Step 2: Verify frontend loads**

Open `http://localhost:5173` in browser. Expect: DrivePick card with input field and Load button.

- [ ] **Step 3: Verify auth flow**

Click Load with a Drive link. Expect: Redirect to Google OAuth (or 401 error if no real Google credentials configured).

- [ ] **Step 4: Verify API endpoints respond**

```bash
curl -s http://localhost:3001/v1/auth/status | jq .
```

Expected: `{"error":"unauthenticated","message":"Not authenticated...","details":[]}`

```bash
curl -s -X POST http://localhost:3001/v1/collections \
  -H "Content-Type: application/json" \
  -d '{"link":"not-a-link"}' | jq .
```

Expected: `{"error":"unauthenticated",...}` (no cookie)

- [ ] **Step 5: Run all tests**

```bash
cd /Users/sriramkk/personal/drive-proj/server && pnpm test
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
cd /Users/sriramkk/personal/drive-proj
git add -A
git commit -m "Sriram | Complete DrivePick v1 implementation"
```
