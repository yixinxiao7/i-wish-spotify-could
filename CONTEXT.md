# Project Context - `i-wish-spotify-could`

_Last updated: August 21, 2026 — frontend audit remediation (see below)._

This document reflects the current workspace state from code inspection plus local test execution.

## 1. Current Workspace Snapshot

- Repo root: `i-wish-spotify-could/`
- Git state at audit time:
1. Modified: `ui/next-env.d.ts`
2. Modified: `ui/tsconfig.json`
3. Untracked: `api/all_uncategorized_songs.json` (~282 KB)
4. Untracked: `api/user_id.json`
- Important: `.gitignore` currently ignores `token.json` but does not ignore `api/user_id.json` or `api/all_uncategorized_songs.json`.

## 2. What the App Does Today

Primary implemented feature: organize liked Spotify songs that are not yet in any user-owned playlist.

Main flow:
1. User logs in with Spotify OAuth.
2. Backend exchanges auth code, stores token data in `token.json`, and refreshes token when needed.
3. Organize page fetches playlists + uncategorized songs.
4. User can preview a song (play/pause on active Spotify device).
5. User adds song to one or more playlists.
6. Song is removed from local uncategorized cache.

Also implemented:
- Logout endpoint and UI logout button that clears local server cache files and client auth marker.

## 3. High-Level Architecture

## Backend (`api/`)
- FastAPI app with routers:
1. `oauth`
2. `songs`
3. `playlists`
4. `playback`
- Token and cache persistence are file-based in API working directory:
1. `token.json`
2. `user_id.json`
3. `all_uncategorized_songs.json`
- Spotify network calls:
1. Most calls route through `app/services/http_client.py` (`spotify_get`, `spotify_post`) with tenacity retry on `429`.
2. Playback service still uses raw `requests.put` directly.

## Frontend (`ui/`)
- Next.js App Router application (package currently declares `next@^16.1.6`, `react@^19.0.0`).
- Key pages:
1. `/login`
2. `/callback`
3. `/` (landing)
4. `/organize`
- `ui/src/app/layout.tsx` is a server component that exports page `metadata` (title/description) and renders `<html><body>`. All client-side behavior — the `sessionStorage.token_expiry` auth gate, navbar, theme toggle, logout — lives in `ui/src/components/app-shell.tsx`, mounted from the server layout. `/organize` and `/login` each have their own thin server `layout.tsx` (just a `metadata` export) since their `page.tsx` files are client components and can't export `metadata` directly.
- Toasts are centralized in `ui/src/components/toast-provider.tsx` (`ToastProvider`/`useToast`), mounted once at the `AppShell` root. There is no longer a per-component toast implementation — `SongCard` and the organize page both call the shared `showToast`.

## 4. Backend Runtime and Endpoints

Backend app entry: `api/app/main.py`

## Routes (effective paths)
1. `POST /api/oauth/`
- Body: `{ code, redirect_uri }`. Rejects `redirect_uri` not present in the server allowlist (`SPOTIFY_REDIRECT_URIS`, falling back to `SPOTIFY_REDIRECT_URI`) with HTTP 400.
- Exchanges authorization code for token and writes `token.json`.
2. `DELETE /api/oauth/logout`
- Deletes any of: `token.json`, `user_id.json`, `all_uncategorized_songs.json`.
3. `GET /api/songs/`
- Returns paginated uncategorized songs with `offset`/`limit` query params.
4. `GET /api/songs/total`
- Returns count from cache file.
5. `GET /api/playlists/`
- Returns current-user-owned playlists.
6. `POST /api/playlists/add-song`
- Adds one song to multiple playlists, then removes song from cache file if present.
7. `PUT /api/playback/start`
8. `PUT /api/playback/stop`

## Notable backend behaviors
- `FastAPI(..., redirect_slashes=False)` is enabled.
- OAuth/token logic in `oauth.py` and `token_service.py` uses `load_dotenv()`.
- Token refresh buffer: 60 seconds before expiry.
- `songs_service.get_total_uncategorized_songs()` waits up to 30 seconds for cache file to appear.
- `playlists_service.add_song_to_playlists()` uses `ThreadPoolExecutor(max_workers=10)`.
- Playback router catches exceptions but returns tuple-like payloads in success status path tests; error branches currently return HTTP 200 with error message text rather than 4xx/5xx.

## 5. Frontend Behavior

Core frontend constants: `ui/src/utils/config.ts`

Notable endpoints include trailing slashes for some routes:
1. `POST_TOKEN_ENDPOINT = .../api/oauth/`
2. `GET_SONGS_ENDPOINT = .../api/songs/`
3. `GET_PLAYLISTS_ENDPOINT = .../api/playlists/`
4. Others are non-trailing slash (`/total`, `/add-song`, `/start`, `/stop`, `/logout`).

## Auth behavior
- `/login`:
1. On mount, if `window.location.hostname === "localhost"`, redirects (`window.location.replace`) to the equivalent `127.0.0.1` origin before anything else runs. Spotify rejects `http://localhost:<port>/callback` as a redirect URI outright (OAuth 2.0 Security BCP loopback rule — only the literal `127.0.0.1` is trusted over plain HTTP), so this makes that origin unreachable during login rather than letting the handshake fail on it.
2. Generates state with `crypto.getRandomValues`.
3. Builds the redirect URI from `window.location.origin` (not a fixed env var), so it always matches the origin serving the page.
4. Stores `oauth_state` and `oauth_redirect_uri` in `sessionStorage`.
5. Redirects to Spotify authorize URL.
- `/callback`:
1. Server component only forwards `code`, `state`, and `error` query params to the client component — it performs no fetch.
2. Client component short-circuits to `/` if a valid `token_expiry` already exists (handles refresh/re-render safely).
3. Otherwise: a provider `error` param renders a declined-consent message; a missing `code` renders an incomplete-response message; `state` is validated against stored `oauth_state` before any code exchange, and a mismatch renders an unverifiable-login message — none of these three cases call the backend.
4. Only on a verified `state` does the client POST `{ code, redirect_uri }` to `/api/oauth/` directly from the browser (not from the server component), using the `redirect_uri` stored at login time.
5. On success, writes `token_expiry` in `sessionStorage` and navigates to `/`; on failure, shows an exchange-failed message with a retry link to `/login`.
6. Callback client effect is guarded with a ref so OAuth handling is idempotent under React Strict Mode double-effect invocation in dev.
- `app-shell.tsx` (client, mounted from the server `layout.tsx`):
1. Redirects unauthenticated users to `/login` except on `/login` and `/callback`.
2. Navbar is hidden on `/login` only (visible on `/callback`).
3. Logout button calls `DELETE /api/oauth/logout`, removes `token_expiry`, and routes to `/login`.
4. Wraps children in `ThemeProvider` and `ToastProvider`.

## Organize page behavior
- On mount, a single `runLoad(offset, limit, isInitial)` orchestrator drives loading: it creates an `AbortController`, calls `fetchSongs` (and `fetchTotalSongs` when `isInitial`), and starts two timers — a 4s "slow" notice and a 25s hard timeout that aborts the request and switches the page into a retry state (`Try again` button, calls `runLoad` again with the same offset/limit/isInitial via a ref). `PlaylistsProvider` fetches playlists independently, same as before.
- While loading, the page renders skeleton song rows (`SongCardSkeleton`) instead of a bare spinner; the "Scanning your liked songs…" notice appears only after the 4s slow-load threshold.
- Uses local state pagination with selectable limits (10/25/50); the limit `Select` has an explicit `aria-label="Songs per page"` since its `SelectLabel` lives inside the closed popup and doesn't name the trigger.
- `SongCard`:
1. Album art renders as a real `next/image` (hero-sized, `alt` set to `"{album} cover art"`); the play/pause control is a small overlay badge in the corner rather than a permanent 40%-opacity scrim across the whole image.
2. Playback toggle calls start/stop endpoints; failures/successes go through the shared toast, not a local one.
3. Playlist dialog with checkbox selection; the album line is omitted when it duplicates the track name.
4. Submission calls add-song endpoint then refresh callback.

## 6. Data Models and Type Contracts

Backend schema models (`api/app/models/schemas.py`):
1. `Code { code: str, redirect_uri: str (non-empty) }`
2. `Pagination { offset: int, limit: int }` (currently unused by router methods)
3. `SongPostData { songId: str, playlistIds: list[str] }`
4. `PlaybackModel { songId: str }`

Frontend types (`ui/src/types/spotify.d.ts`):
- `Song` includes fields not returned by backend (`duration_ms`, `explicit`, `preview_url`, `track_number`, `popularity`, `external_urls`), while backend primarily returns:
1. `id`
2. `name`
3. `artists`
4. `album`
5. `album_pic_url`
- `Playlist` aligns with backend shape.

## 7. Environment and Config

Backend vars used:
1. `SPOTIFY_CLIENT_ID`
2. `SPOTIFY_CLIENT_SECRET`
3. `SPOTIFY_REDIRECT_URI` (single-URI fallback, used only when `SPOTIFY_REDIRECT_URIS` is unset)
4. `SPOTIFY_REDIRECT_URIS` (comma-separated allowlist of redirect URIs the token exchange will accept)
5. `FRONTEND_URL` (optional CORS allowlist extension)

Frontend vars used:
1. `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`
2. `NEXT_PUBLIC_WEB_HOST` (no longer drives the OAuth redirect URI, which is derived from `window.location.origin` instead — see Auth behavior)
3. `NEXT_PUBLIC_SERVER_HOST`

Deployment config:
- `render.yaml` defines one Python web service (`rootDir: api`) with env vars above.

## 8. Test Coverage and Current Test Status

## Backend tests
- Present: `api/tests/` with 13 files and 49 test functions.
- Scope includes routers, services, model schema construction, OAuth logout behavior, and token refresh logic.
- Local execution status in this environment:
1. `pytest` command missing.
2. `python3 -m pytest` fails: `No module named pytest`.
- Result: backend tests were not executed in this audit environment.

## Frontend tests
- Present: 26 Jest test files under `ui/src`.
- Local execution command: `npm test -- --runInBand`.
- Result:
1. 24 suites total.
2. 24 passed.
3. 0 failed.
4. 94 tests total: 94 passed, 0 failed.
- Coverage (`npm test -- --coverage`): ~95% statements / ~87% branches / ~95% functions / ~96% lines, above the enforced 85% `jest.config.js` threshold. `app/organize/page.tsx` branch coverage (73%) is the weakest spot — the uncovered lines are pre-existing pagination-link edge cases, not the new load/timeout/retry logic (which is covered).

Non-fatal test console warnings currently observed:
- DOM nesting warning in `layout.test.tsx` (`<html>` inside RTL container) — expected, since that's the one place in the app the real `<html>` tag renders.

## 9. Key Gaps and Risks (As of This Snapshot)

1. File-based state and single-user assumptions remain.
2. Cache invalidation is partial; uncategorized cache updates only on add-song and manual file lifecycle.
3. `/api/songs/total` can still block up to 30s server-side before the cache file appears. The frontend now applies a client-side 25s timeout with a skeleton-loading UI and a retry action (see `ui/src/app/organize/page.tsx`), but the backend's own blocking wait is unchanged — out of scope for this remediation pass, tracked for a future backend-side fix (e.g. a 202-style "still indexing" response).
4. Playback error handling returns success HTTP status in failure branches.
5. Logout client flow has no explicit error handling around failed network call before route push (documented by an `app-shell.test.tsx` case).
6. Runtime artifact files are currently untracked but not ignored (`api/user_id.json`, `api/all_uncategorized_songs.json`).
7. No playlist search/filter in the add-to-playlist dialog — with a large playlist library, pinning only helps the top few; deferred from the audit remediation as a feature, not a fix.

## 10. Practical Runbook

Backend:
```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd ui
npm install
npm run dev
```

Frontend tests:
```bash
cd ui
npm test -- --runInBand
```

Backend tests (once pytest is installed in active Python env):
```bash
cd api
python3 -m pytest
```
