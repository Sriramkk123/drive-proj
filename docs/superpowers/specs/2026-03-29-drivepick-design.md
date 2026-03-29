# DrivePick -- Design Spec

**Date:** 2026-03-29
**Status:** Draft

## Overview

DrivePick is a web app that lets a user paste a Google Drive folder or Google Photos album link, view all photos and videos in a grid, select the ones they want, name an album, and create a new Drive folder or Photos album containing only the selected items.

## User Flow

1. **Link Input** -- User pastes a Google Drive folder URL or Google Photos album URL and clicks "Load"
2. **OAuth** -- If not authenticated, redirect to Google OAuth. Token stored in HttpOnly cookie. Redirects back after auth.
3. **Gallery** -- Grid of thumbnails with select/deselect toggle per item. Top bar shows selected count, "Select All", and "Create Album" button.
4. **Name Album** -- Modal dialog prompts user to name the new album/folder. Cancel or Create.
5. **Result** -- Success screen with link to the newly created Drive folder or Photos album. Options to copy link, open in Google, or start over.

## Architecture

```
React SPA (Vite + shadcn/ui)  -->  Fastify API (TypeScript)  -->  Google APIs (Drive v3 / Photos Library)
```

### Frontend

- **Framework:** React + Vite + TypeScript
- **UI:** shadcn/ui
- **Routing:** React Router (3 routes: `/`, `/collections/:id`, `/collections/:id/result`)
- **Server state:** TanStack Query
- **Client state:** Zustand (selection state -- which media items are selected)
- **Theme:** Dark mode

### Backend

- **Framework:** Fastify + TypeScript
- **Auth:** Google OAuth 2.0, tokens in HttpOnly cookies
- **Storage:** In-memory Map with TTL (no database for v1)

## API Endpoints

### Auth

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/v1/auth/status` | Check if user is authenticated | 200 / 401 |
| GET | `/v1/auth/google` | Initiate Google OAuth flow | 302 |
| GET | `/v1/auth/google/callback` | Handle OAuth callback, set HttpOnly cookie | 302 |

### Collections

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/v1/collections` | Accept a Drive/Photos link, parse and validate it, return collection ID + metadata. Media is fetched asynchronously. | 201 |
| GET | `/v1/collections/:id` | Get collection metadata (name, source type, media count, fetch status) | 200 / 404 |
| GET | `/v1/collections/:id/media` | Paginated list of media items | 200 / 404 |

### Media

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/v1/media/:mediaId/thumbnail` | Proxy thumbnail image from Google | 200 / 404 |

### Exports

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/v1/collections/:id/exports` | Accept selected media IDs + album name, create new Drive folder or Photos album, copy files, return output link | 201 |

### Request/Response Examples

**GET /v1/auth/status**
```json
// Response 200 (authenticated)
{
  "authenticated": true,
  "email": "user@gmail.com"
}

// Response 401 (not authenticated)
{
  "error": "unauthenticated",
  "message": "Not authenticated. Redirect to /v1/auth/google.",
  "details": []
}
```

**POST /v1/collections**
```json
// Request
{ "link": "https://drive.google.com/drive/folders/1abc123" }

// Response 201
{
  "id": "uuid",
  "sourceType": "drive",
  "name": "Trip Photos 2026",
  "status": "fetching"
}
```

The collection is created immediately. Media items are fetched from Google in the background. The frontend polls `GET /v1/collections/:id` until `status` becomes `"ready"`.

**GET /v1/collections/:id**
```json
// Response 200
{
  "id": "uuid",
  "sourceType": "drive",
  "name": "Trip Photos 2026",
  "status": "ready",
  "mediaCount": 48,
  "createdAt": "2026-03-29T10:00:00Z",
  "expiresAt": "2026-03-29T11:00:00Z"
}
```

Collection `status` values: `"fetching"` | `"ready"` | `"failed"`

**GET /v1/collections/:id/media?page=1&limit=50&sort=name&order=asc**
```json
// Response 200
{
  "items": [
    {
      "id": "media-uuid",
      "name": "IMG_1234.jpg",
      "mimeType": "image/jpeg",
      "thumbnailUrl": "/v1/media/media-uuid/thumbnail",
      "width": 4032,
      "height": 3024
    }
  ],
  "page": 1,
  "limit": 50,
  "total": 48,
  "hasNext": false
}
```

Query params:
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `sort` (default: `name`, options: `name`, `created_at`)
- `order` (default: `asc`, options: `asc`, `desc`)

**POST /v1/collections/:id/exports**
```json
// Request
{
  "name": "Trip Photos 2026 - Best Picks",
  "mediaIds": ["media-uuid-1", "media-uuid-2"]
}

// Response 201
{
  "id": "export-uuid",
  "name": "Trip Photos 2026 - Best Picks",
  "link": "https://drive.google.com/drive/folders/1xyz789",
  "sourceType": "drive",
  "itemCount": 12
}
```

### Error Envelope

All errors follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable description.",
  "details": []
}
```

| Code | Status | When |
|------|--------|------|
| `unauthenticated` | 401 | No valid auth token |
| `invalid_link` | 400 | URL is not a recognized Google Drive/Photos link |
| `not_found` | 404 | Collection or media ID does not exist (or expired) |
| `collection_not_ready` | 409 | Attempted to list media or export while collection is still fetching |
| `export_failed` | 500 | Google API error during folder/album creation |

## Data Model

### Collection (in-memory)

```typescript
interface Collection {
  id: string;                          // uuid
  sourceType: "drive" | "photos";
  sourceId: string;                    // Google folder/album ID
  name: string;                        // folder/album name from Google
  status: "fetching" | "ready" | "failed";
  createdAt: Date;
  expiresAt: Date;                     // TTL, default 1 hour
  media: MediaItem[];
}

interface MediaItem {
  id: string;                          // uuid, globally unique
  name: string;
  mimeType: string;
  thumbnailUrl: string;                // Google's URL (proxied through backend)
  sourceFileId: string;                // Google's file/media ID
  width: number;
  height: number;
}

interface Export {
  id: string;                          // uuid
  collectionId: string;
  name: string;
  link: string;                        // URL to the created Drive folder or Photos album
  sourceType: "drive" | "photos";
  itemCount: number;
  createdAt: Date;
}
```

## Google API Integration

### Link Parsing

- Drive: `drive.google.com/drive/folders/{folderId}` -> Google Drive API v3
- Photos: `photos.google.com/share/{albumId}` or `photos.app.goo.gl/...` -> Google Photos Library API

### Reading Media

- **Drive:** `files.list` with folder ID as parent, filter `mimeType` for `image/*` or `video/*`
- **Photos:** `mediaItems.search` with album ID

### Creating Output

- **Drive:** `files.create` (new folder) + `files.copy` per selected file into that folder
- **Photos:** `albums.create` + `mediaItems.batchCreate` for selected items

### OAuth Scopes

- `drive.readonly` -- read source folder contents
- `drive.file` -- create output folder and copy files
- `photoslibrary.readonly` -- read source album
- `photoslibrary.appendonly` -- create album and add items

## Thumbnail Proxy

The `GET /v1/media/:mediaId/thumbnail` endpoint proxies thumbnails from Google's CDN. The backend looks up the media item across all active collections, fetches the image from Google using the stored auth token, and streams it to the client. Response includes `Cache-Control: public, max-age=3600` to leverage browser caching. No server-side caching in v1.

## v1 Limitations

- **Google Photos copying:** The Photos API doesn't support copying media between albums directly. The source album must belong to the authenticated user or the items must already be in their library.
- **No persistence:** Collections are in-memory with 1-hour TTL. Refreshing after expiry requires re-pasting the link.
- **Single user:** No multi-user support. Personal use only.
- **No preview:** No full-size image lightbox in v1. Grid thumbnails only.
- **Large folders:** Collections with 500+ items may take time to fetch. The async fetch model handles this, but the UI should show a loading/progress indicator.

## UI Screens

Mockups are in `pencil-new.pen` with 4 frames:

1. **1. Link Input** -- Centered card with "DrivePick" branding, paste input, Load button
2. **2. Gallery View** -- Top bar (breadcrumb, selection count, Select All, Create Album), 4-column photo grid with select/deselect checkmarks, dimmed deselected items, video play overlay
3. **2b. Name Album Modal** -- Modal dialog with album name input, Cancel/Create buttons
4. **3. Result** -- Success card with green checkmark, album name, item count, copyable link, "Open in Google Drive/Photos" button, "Start Over" button

**Theme:** Dark mode (background `#0A0A0A`, cards `#1A1A1A`, accent `#4A9FD8`)

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript, shadcn/ui, React Router, TanStack Query, Zustand |
| Backend | Fastify, TypeScript |
| Auth | Google OAuth 2.0, HttpOnly cookies |
| APIs | Google Drive API v3, Google Photos Library API |
| Storage | In-memory Map (v1) |
| Containerization | Docker + docker-compose |
