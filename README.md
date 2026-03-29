# DrivePick

Paste a Google Drive folder or Google Photos album link, view all photos and videos in a grid, select the ones you want, and create a new folder/album with just the selected items.

## Prerequisites

- **Node.js** >= 22 (use `nvm use` if available)
- **pnpm** (install with `corepack enable && corepack prepare pnpm@latest --activate`)
- **Google Cloud Console** project with OAuth 2.0 credentials (see below)

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable these APIs:
   - Google Drive API
   - Google Photos Library API
4. Go to **APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3001/v1/auth/google/callback`
5. Copy the Client ID and Client Secret

## Environment Variables

Copy the example env file and fill in your values:

```bash
cp server/.env.example server/.env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console | (required) |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret | (required) |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `http://localhost:3001/v1/auth/google/callback` |
| `SESSION_SECRET` | Secret for signing cookies (any random string) | (required) |
| `FRONTEND_URL` | Frontend origin for CORS and redirects | `http://localhost:5173` |
| `COLLECTION_TTL_MS` | How long collections stay in memory (ms) | `3600000` (1 hour) |

Example `server/.env`:

```env
PORT=3001
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3001/v1/auth/google/callback
SESSION_SECRET=my-super-secret-random-string-change-me
FRONTEND_URL=http://localhost:5173
COLLECTION_TTL_MS=3600000
```

## Local Development

### Install dependencies

```bash
# Server
cd server
pnpm install

# Web (from project root)
cd ../web
pnpm install
```

### Start the server

```bash
cd server
pnpm dev
```

Server runs at `http://localhost:3001`. Logs are formatted with pino-pretty.

### Start the frontend

In a separate terminal:

```bash
cd web
pnpm dev
```

Frontend runs at `http://localhost:5173`. API calls to `/v1/*` are proxied to the server automatically.

### Open the app

Go to `http://localhost:5173` in your browser.

## Running Tests

```bash
# Server tests (link parser + collection store)
cd server
pnpm test

# Watch mode
pnpm test:watch
```

## Available Scripts

### Server (`server/`)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled server from `dist/` |
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint |

### Web (`web/`)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Run ESLint |

## Docker

Build and run both services:

```bash
# Create .env in project root (same vars as server/.env)
cp server/.env.example .env
# Fill in values...

docker compose up --build
```

- Server: `http://localhost:3001`
- Web: `http://localhost:80`

## API Endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/auth/status` | Check authentication status |
| GET | `/v1/auth/google` | Start Google OAuth flow |
| GET | `/v1/auth/google/callback` | OAuth callback (sets cookie) |

### Collections

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/collections` | Create collection from a Google link |
| GET | `/v1/collections/:id` | Get collection metadata + fetch status |
| GET | `/v1/collections/:id/media` | List media (paginated) |

### Media

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/media/:mediaId/thumbnail` | Proxy thumbnail from Google |

### Exports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/collections/:id/exports` | Create new folder/album from selected items |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, shadcn/ui, Tailwind CSS v4, React Router, TanStack Query, Zustand |
| Backend | Fastify 5, TypeScript, googleapis |
| Auth | Google OAuth 2.0, HttpOnly cookies |
| Testing | Vitest |
| Containerization | Docker, docker-compose |

## Project Structure

```
drive-proj/
  server/
    src/
      index.ts              # Fastify entrypoint
      config.ts             # Env var loading
      types.ts              # Shared TypeScript types
      errors.ts             # Domain error classes
      plugins/
        auth.ts             # Cookie auth plugin
      routes/
        auth.ts             # OAuth routes
        collections.ts      # Collection CRUD
        media.ts            # Thumbnail proxy
        exports.ts          # Album/folder creation
      services/
        link-parser.ts      # Google URL parsing
        collection-store.ts # In-memory store with TTL
        google-drive.ts     # Drive API wrapper
        google-photos.ts    # Photos API wrapper
      __tests__/
        link-parser.test.ts
        collection-store.test.ts
  web/
    src/
      App.tsx               # Router + providers
      main.tsx              # React entrypoint
      api/                  # Fetch client + TanStack Query hooks
      stores/               # Zustand selection store
      pages/                # LinkInput, Gallery, Result
      components/           # TopBar, MediaCard, MediaGrid, NameAlbumModal
      components/ui/        # shadcn/ui primitives
```
