# DrivePick -- Design Decisions

## Google Photos: Picker API instead of Library API

**Decision:** Use the Google Photos Picker API instead of the Library API.

**Context:** The original design assumed we could use the Google Photos Library API to list album contents by URL (like we do with Google Drive). During implementation (March 2026), we discovered this is impossible for new Google Cloud projects.

**Why:**
- Google deprecated the Photos Library API's read scopes (`photoslibrary.readonly`, `photoslibrary.sharing`) on March 31, 2025
- All shared album endpoints (`sharedAlbums.get/join/list`) return 403 PERMISSION_DENIED
- The `photoslibrary.appendonly` scope still works but can only access media your app created -- useless for reading existing albums
- No workaround exists: RSS feeds died in 2017, web scraping yields only preview quality, partner APIs have the same restrictions
- This affects ALL new Google Cloud projects, not just ours

**Alternative chosen:** The Google Photos Picker API (`photospicker.mediaitems.readonly` scope). This opens Google's own UI where the user manually selects photos. Different UX from Drive (no grid browsing on our side), but functional.

**Trade-off:** Users can't paste a Google Photos album URL and auto-load all contents. Instead they click "Pick from Google Photos", select in Google's UI, then review selections in our grid. This is Google's intended flow going forward.

## Photos exports go to Google Drive, not Google Photos

**Decision:** All exports create a Google Drive folder, even when the source is Google Photos.

**Context:** The original design had "mirror the source" -- Drive in → Drive out, Photos in → Photos out.

**Why:**
- The Photos Library API's `albums.create` and `mediaItems.batchCreate` methods require the `photoslibrary.appendonly` scope
- This scope was NOT removed in the March 2025 deprecation, but it only works for media your app uploaded -- you cannot add existing user media to a new album
- Creating a Photos album would require downloading each photo and re-uploading it via the Library API, which creates duplicate media in the user's Google Photos (bad UX)
- Google Drive folder creation works reliably and doesn't create duplicates in the user's library

**Trade-off:** Users always get a Drive folder link, even when they picked from Google Photos. This is clearly communicated in the UI ("saves to Drive").

## In-memory storage instead of a database

**Decision:** Collections are stored in an in-memory Map with 1-hour TTL. No database.

**Why:**
- v1 is for personal use (single user)
- Collections are ephemeral -- they exist only while the user is curating photos
- Adding a database for temporary state is unnecessary complexity
- The TTL handles cleanup automatically

**Trade-off:** Server restart loses all active collections. Users must re-paste their link. Acceptable for v1.

## Server-proxied thumbnails instead of direct Google URLs

**Decision:** Thumbnails are served through `GET /v1/media/:mediaId/thumbnail` which proxies from Google.

**Why:**
- Google's thumbnail URLs require an OAuth access token in the Authorization header
- Browser `<img>` tags can't send Authorization headers
- Exposing Google thumbnail URLs to the frontend would require passing access tokens to the client (security risk, violates HttpOnly cookie approach)
- The proxy adds Cache-Control headers for browser caching

**Trade-off:** More backend traffic (every thumbnail request goes through our server). Acceptable at personal-use scale. Could add server-side caching later if needed.

## Async collection creation with polling

**Decision:** `POST /v1/collections` returns immediately with `status: "fetching"`. Media is fetched in the background. Frontend polls until `status` becomes `"ready"`.

**Why:**
- Large Google Drive folders (500+ files) can take 10+ seconds to list via the Drive API (paginated, 100 per page)
- HTTP requests that take that long risk timeouts (browser, proxy, load balancer defaults are often 30-60s)
- Returning immediately gives the user feedback that something is happening

**Trade-off:** Slightly more complex frontend (polling logic). TanStack Query's `refetchInterval` makes this straightforward.

## sessionStorage for persisting state across OAuth redirect

**Decision:** When an unauthenticated user pastes a link or clicks "Pick from Google Photos", we save the pending action to `sessionStorage` before redirecting to Google OAuth. After returning, the action auto-resumes.

**Why:**
- OAuth redirect loses all React state (full page navigation to Google, then back)
- Without this, users have to re-paste their link after authenticating (frustrating)
- `sessionStorage` is scoped to the tab and clears on close -- appropriate for this ephemeral state
- Not a security concern since we're storing a Google Drive URL, not credentials

**Alternative considered:** Using OAuth `state` parameter to encode the pending link. Rejected because it would require backend changes and the link could exceed URL length limits.

## Dark mode only (no light mode toggle)

**Decision:** Ship with dark mode only, no theme toggle.

**Why:**
- Reduces scope for v1
- Dark mode works well for a photo curation app (photos pop against dark backgrounds)
- Can add a toggle later without architectural changes (CSS variables are already set up)
