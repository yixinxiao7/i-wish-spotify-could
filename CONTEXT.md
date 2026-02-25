# Project Context - `i-wish-spotify-could`

_Last updated: February 25, 2026_

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
- Root layout is a client component and performs client-side auth gating via `sessionStorage.token_expiry`.

## 4. Backend Runtime and Endpoints

Backend app entry: `api/app/main.py`

## Routes (effective paths)
1. `POST /api/oauth/`
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
1. Generates state with `crypto.getRandomValues`.
2. Stores `oauth_state` in `sessionStorage`.
3. Redirects to Spotify authorize URL.
- `/callback`:
1. Server component posts code to backend.
2. Client component validates returned `state` against stored `oauth_state`.
3. Writes `token_expiry` in `sessionStorage`.
4. Callback client effect is guarded with a ref so OAuth handling is idempotent under React Strict Mode double-effect invocation in dev.
- `layout.tsx`:
1. Redirects unauthenticated users to `/login` except on `/login` and `/callback`.
2. Navbar is hidden on `/login` only (visible on `/callback`).
3. Logout button calls `DELETE /api/oauth/logout`, removes `token_expiry`, and routes to `/login`.

## Organize page behavior
- On mount, it calls:
1. `fetchPlaylists()`
2. `fetchTotalSongs()`
3. `fetchSongs(offset, limit)`
- Uses local state pagination with selectable limits (10/25/50).
- `SongCard`:
1. Playback toggle calls start/stop endpoints.
2. Playlist dialog with checkbox selection.
3. Submission calls add-song endpoint then refresh callback.
4. Uses `alert()` for user feedback.

## 6. Data Models and Type Contracts

Backend schema models (`api/app/models/schemas.py`):
1. `Code { code: str }`
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
3. `SPOTIFY_REDIRECT_URI`
4. `FRONTEND_URL` (optional CORS allowlist extension)

Frontend vars used:
1. `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`
2. `NEXT_PUBLIC_WEB_HOST`
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
- Present: 16 Jest test files under `ui/src`.
- Local execution command: `npm test -- --runInBand`.
- Result:
1. 16 suites total.
2. 16 passed.
3. 0 failed.
4. 44 tests total: 44 passed, 0 failed.

Non-fatal test console warnings currently observed:
- DOM nesting warning in layout tests (`<html>` inside RTL container).
- DOM nesting warning in song dialog tests (`<p>` nested inside `<p>` through dialog description composition).

## 9. Key Gaps and Risks (As of This Snapshot)

1. File-based state and single-user assumptions remain.
2. Cache invalidation is partial; uncategorized cache updates only on add-song and manual file lifecycle.
3. `/api/songs/total` depends on cache file existence and can timeout when called before cache creation.
4. Playback error handling returns success HTTP status in failure branches.
5. Logout client flow has no explicit error handling around failed network call before route push.
6. `ui/src/styles/globals.css` appears legacy/duplicate relative to `ui/src/app/globals.css`.
7. Runtime artifact files are currently untracked but not ignored (`api/user_id.json`, `api/all_uncategorized_songs.json`).

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
