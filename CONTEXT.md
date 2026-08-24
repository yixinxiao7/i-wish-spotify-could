# Project Context - `i-wish-spotify-could`

_Last updated: August 23, 2026 — uncategorized-songs load speedup (parallel index build, freshness/manual refresh, atomic writes; see §4 "Uncategorized-songs index" and §5 "Organize page behavior" below). Prior entry: August 21, 2026 — frontend audit remediation._

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
- Returns count from the uncategorized-songs index.
5. `POST /api/songs/refresh`
- Forces the uncategorized-songs index to rebuild from Spotify now, ignoring the freshness window. Returns `{ "total": int }`. `502` if the rebuild fails; the previous index is left intact.
6. `GET /api/playlists/`
- Returns current-user-owned playlists.
7. `POST /api/playlists/add-song`
- Adds one song to multiple playlists, then removes the song from the uncategorized-songs index via `songs_service.remove_song_from_index()` (the router no longer touches the cache file directly).
8. `PUT /api/playback/start`
9. `PUT /api/playback/stop`

## Notable backend behaviors
- `FastAPI(..., redirect_slashes=False)` is enabled.
- OAuth/token logic in `oauth.py` and `token_service.py` uses `load_dotenv()`.
- Token refresh buffer: 60 seconds before expiry.
- `playlists_service.add_song_to_playlists()` and the uncategorized-songs index build share one bounded concurrency ceiling (`http_client.CONCURRENCY_CEILING = 8`) and one pooled `requests.Session`, rather than each opening their own connections or thread pools.
- `http_client.py`'s 429 retry honors Spotify's `Retry-After` header when present, falling back to the previous exponential backoff otherwise — relevant because the app runs under Spotify's Development Mode quota, which is tighter than extended quota.
- Playback router catches exceptions but returns tuple-like payloads in success status path tests; error branches currently return HTTP 200 with error message text rather than 4xx/5xx.

## Uncategorized-songs index (`songs_service.py`)

Rebuilt from a strict, mostly-serial cache into a bounded-concurrency build with
an explicit freshness contract. Measured against a live library of ~1,579 liked
songs / 26 owned playlists / ~2,667 playlist tracks: cold build **~2.3s** (down
from ~15–21s), warm read **~9ms**.

- **Storage format**: `api/all_uncategorized_songs.json` is now a versioned
  envelope — `{"version": 2, "built_at": <unix seconds>, "songs": [...]}` —
  instead of a bare array. A file in the old bare-array format, or one that's
  unparseable or missing `built_at`, is treated as if no index existed and is
  rebuilt silently (no error surfaced to the user). **This is a breaking
  change to local runtime state only**; a rollback to pre-change code cannot
  read the new format and needs the cache file deleted (it rebuilds itself on
  the next request).
- **Atomic writes**: published via a temp file + `os.replace()` in the same
  directory, so a concurrent reader never observes a truncated file. This
  closes a latent race that existed even before this change (`os.path.exists`
  returns true the instant a write truncates the file) — it was mostly hidden
  by the old 2-second poll granularity and becomes more reachable now that
  builds are fast enough to overlap with reads.
- **In-memory cache**: a process-level `(mtime, songs)` pair avoids re-parsing
  the file on every paginated read; invalidated automatically when the file's
  mtime changes (a write from this process, or an external one).
- **Concurrent build**: liked-song pages and each owned playlist's item pages
  fan out across offsets computed from each response's `total`, submitted to
  one shared pool sized to `CONCURRENCY_CEILING` (8) — bounded regardless of
  library size, so the build can't fan out past what Development Mode quota
  tolerates. Playlist item pages request `fields=items(item(id)),next,total`
  to transfer track IDs only (~0.8 KB/page vs ~44.6 KB unfiltered — verified
  live). If a playlist reports tracks but the filtered response yields zero
  IDs, `playlists_service.PlaylistIntegrityError` is raised and **fails the
  whole build** rather than being treated as an ordinary per-playlist failure
  — that pattern means the Spotify `fields` expression broke, and swallowing
  it the way an ordinary playlist read failure is swallowed would silently
  report the user's entire library as uncategorized instead of failing
  loudly.
- **Single-flight cold builds**: concurrent requests that arrive with no index
  on disk join one in-progress build via a `threading.Event`-backed record
  rather than polling; a build failure propagates to every waiter instead of
  each one hanging to its own timeout.
- **Freshness**: an index older than 15 minutes
  (`songs_service._FRESHNESS_WINDOW_SECONDS`) is still served immediately,
  with a background rebuild kicked off behind it (single-flight — at most one
  background rebuild runs at a time). A failed background rebuild logs and
  leaves the previous index intact.
- **Manual refresh**: `POST /api/songs/refresh` (`songs_service.force_rebuild`)
  rebuilds synchronously regardless of freshness, for when a change made
  directly in Spotify needs to be picked up without logging out. Verified live
  against the real account: filing a song into a playlist directly via the
  Spotify API, then calling refresh, dropped it from the uncategorized list
  immediately.
- **Filing a song** (`songs_service.remove_song_from_index`) corrects the
  stored index in place — removes the song and preserves the existing
  `built_at` — rather than triggering a rebuild, since a single known removal
  doesn't change how stale the rest of the index is.
- **Single-process assumption**: the in-memory cache and build-coordination
  state are process-level globals. `render.yaml` and local dev both run one
  backend worker, so this is safe today; adding workers would let each build
  its own index independently (wasted quota, not correctness — the atomic
  write keeps the file itself consistent either way).

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
- A "Refresh from Spotify" button (`handleForceRefresh`) posts to `POST /api/songs/refresh`, then re-fetches the current page of songs and the total. Doesn't route through the skeleton-loading `runLoad` pipeline — the currently displayed songs stay on screen with the button showing "Refreshing…" and disabled, rather than flashing the whole page to a loading state. Reports success/failure through the shared toast; on failure the displayed songs are left unchanged (the refresh-endpoint call is what's guarded — a failure there means `fetchSongs`/`fetchTotalSongs` are never called).
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
- Present: `api/tests/` with 15 files and 136 test functions (added `test_service_http_client.py`; extended `test_service_songs.py`, `test_service_playlists.py`, `test_router_songs.py`, `test_router_playlists.py`, `test_service_users.py` for the uncategorized-songs load speedup — parallel build, envelope storage/atomic writes, single-flight build coordination, freshness/background refresh, the `PlaylistIntegrityError` guard, and the refresh endpoint).
- Scope includes routers, services, model schema construction, OAuth logout behavior, token refresh logic, and (as of this pass) threading-timing paths tested with `threading.Event`/`Barrier` synchronization rather than real sleeps.
- Local execution: `cd api && python3 -m pytest` (via `venv/bin/python -m pytest`) — 136 passed, 98% overall statement coverage (`songs_service.py` 98%, `playlists_service.py` 99%, `http_client.py` 100%), above the project's 90% target. The 5 uncovered lines are defensive edge cases (a file vanishing mid-read between `stat` and `open`; cleanup-of-cleanup failure paths).

## Frontend tests
- Present: 24 Jest test files under `ui/src`.
- Local execution command: `npm test -- --runInBand`.
- Result:
1. 24 suites total.
2. 24 passed.
3. 0 failed.
4. 98 tests total: 98 passed, 0 failed (added 4 tests for the organize page's "Refresh from Spotify" control).
- Coverage (`npm test -- --coverage`): ~95% statements / ~86% branches / ~95% functions / ~96% lines, above the enforced 85% `jest.config.js` threshold. `app/organize/page.tsx` branch coverage remains the weakest spot — the uncovered lines are the same pre-existing pagination-link edge cases as before this pass (`handleOffsetChange`'s boundary clamps, individual pagination-link click handlers); the new `handleForceRefresh` path is fully covered.

Non-fatal test console warnings currently observed:
- DOM nesting warning in `layout.test.tsx` (`<html>` inside RTL container) — expected, since that's the one place in the app the real `<html>` tag renders.

## 9. Key Gaps and Risks (As of This Snapshot)

1. File-based state and single-user assumptions remain.
2. Playback error handling returns success HTTP status in failure branches.
3. Logout client flow has no explicit error handling around failed network call before route push (documented by an `app-shell.test.tsx` case).
4. Runtime artifact files are currently untracked but not ignored (`api/user_id.json`, `api/all_uncategorized_songs.json`).
5. No playlist search/filter in the add-to-playlist dialog — with a large playlist library, pinning only helps the top few; deferred from the audit remediation as a feature, not a fix.
6. Process-level state (the in-memory index cache, cold-build coordination, background-refresh guard) assumes a single backend worker — see `songs_service.py` note in §4. `render.yaml` and local dev both run one worker today, so this holds, but it's an assumption to keep in mind before scaling the backend horizontally.

**Closed by the uncategorized-songs load speedup (2026-08-23):**
- ~~Cache invalidation is partial; uncategorized cache updates only on add-song and manual file lifecycle.~~ A stale index (>15 min) now triggers a background rebuild automatically, and `POST /api/songs/refresh` lets the user force one on demand — verified live against the real account (see §4).
- ~~`/api/songs/total` can still block up to 30s server-side before the cache file appears.~~ Cold builds now complete in ~2.3s against the current library (down from ~15–21s), measured live; the frontend's 25s timeout and skeleton UI remain in place as a safety net but are no longer load-bearing for the common case.

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
