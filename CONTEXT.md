# Project Context - `i-wish-spotify-could`

_Last updated: August 24, 2026 — playlist cleanup feature (`/clean`, `/clean/[playlistId]`; least-listened sorting via a listening-affinity signal; deferred, undoable song removal; see §4 "Playlist-songs and listening-affinity services" and §5 "Clean playlist pages" below). Prior entry: August 23, 2026 — uncategorized-songs load speedup._

This document reflects the current workspace state from code inspection plus local test execution.

## 1. Current Workspace Snapshot

- Repo root: `i-wish-spotify-could/`
- Git state at audit time:
1. Modified: `ui/next-env.d.ts`
2. Modified: `ui/tsconfig.json`
3. Untracked: `api/all_uncategorized_songs.json` (~282 KB)
4. Untracked: `api/user_id.json`
- Important: `.gitignore` ignores `token.json`, `pinned_playlists.json`, and (as of this change) `track_affinity.json`, but still does not ignore `api/user_id.json` or `api/all_uncategorized_songs.json`.

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
- **Playlist cleanup** (`/clean`, `/clean/[playlistId]`): the reverse tool — finding songs to remove from a playlist the user already owns. `/clean` lists owned playlists (reusing the same `PlaylistList` component and pinning as everywhere else); picking one opens `/clean/[playlistId]`, which shows that playlist's songs (via the same `SongCard` presentation as `/organize`) sorted by playlist order, date added (either direction), or a "least listened" estimate. Removing a song is deferred five seconds behind an undo toast before the actual Spotify call fires.

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
4. `pinned_playlists.json`
5. `track_affinity.json` (new — listening-affinity cache)
- Spotify network calls:
1. Most calls route through `app/services/http_client.py` (`spotify_get`, `spotify_post`, `spotify_delete`) with tenacity retry on `429`.
2. Playback service still uses raw `requests.put` directly.

## Frontend (`ui/`)
- Next.js App Router application (package currently declares `next@^16.1.6`, `react@^19.0.0`).
- Key pages:
1. `/login`
2. `/callback`
3. `/` (landing)
4. `/organize`
5. `/clean` (new — playlist chooser)
6. `/clean/[playlistId]` (new — playlist cleanup view)
- `ui/src/app/layout.tsx` is a server component that exports page `metadata` (title/description) and renders `<html><body>`. All client-side behavior — the `sessionStorage.token_expiry` auth gate, navbar, theme toggle, logout — lives in `ui/src/components/app-shell.tsx`, mounted from the server layout. `/organize` and `/login` each have their own thin server `layout.tsx` (just a `metadata` export) since their `page.tsx` files are client components and can't export `metadata` directly.
- Toasts are centralized in `ui/src/components/toast-provider.tsx` (`ToastProvider`/`useToast`), mounted once at the `AppShell` root. There is no longer a per-component toast implementation — `SongCard` and the organize page both call the shared `showToast`.

## 4. Backend Runtime and Endpoints

Backend app entry: `api/app/main.py`

## Routes (effective paths)
1. `POST /api/oauth/`
- Body: `{ code, redirect_uri }`. Rejects `redirect_uri` not present in the server allowlist (`SPOTIFY_REDIRECT_URIS`, falling back to `SPOTIFY_REDIRECT_URI`) with HTTP 400.
- Exchanges authorization code for token and writes `token.json`.
2. `DELETE /api/oauth/logout`
- Deletes any of: `token.json`, `user_id.json`, `all_uncategorized_songs.json`, `pinned_playlists.json`, `track_affinity.json`.
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
8. `GET /api/playlists/{playlist_id}/songs` (new)
- Query params `offset`, `limit`, `sort` (`playlist`|`added_asc`|`added_desc`|`affinity_asc`). `404` if the playlist is unknown or not owned by the current user (looked up via `get_created_playlists`, which is owned-only by construction). `400` for an unrecognized `sort`. Returns `{playlist: {id, name}, songs: [...], total, affinity: {available, reason}}` — each song carries `affinity_tier` (0–3), attached at read time from whatever affinity map was passed in, not stored on the cached list.
9. `DELETE /api/playlists/{playlist_id}/songs` (new)
- Body `{songId}`. `403` on a permission failure, `502` on any other failure. On success, invalidates that playlist's cached song list (`playlist_songs_service.invalidate_playlist_cache`) and marks the uncategorized-songs index stale (`songs_service.mark_index_stale`) so a later read triggers exactly one background rebuild — removing a song can make a liked song uncategorized again.
10. `PUT /api/playback/start`
11. `PUT /api/playback/stop`

## Notable backend behaviors
- `FastAPI(..., redirect_slashes=False)` is enabled.
- OAuth/token logic in `oauth.py` and `token_service.py` uses `load_dotenv()`.
- Token refresh buffer: 60 seconds before expiry.
- `playlists_service.add_song_to_playlists()` and the uncategorized-songs index build share one bounded concurrency ceiling (`http_client.CONCURRENCY_CEILING = 8`) and one pooled `requests.Session`, rather than each opening their own connections or thread pools.
- `http_client.py`'s 429 retry honors Spotify's `Retry-After` header when present, falling back to the previous exponential backoff otherwise — relevant because the app runs under Spotify's Development Mode quota, which is tighter than extended quota. **The honored wait is capped at `MAX_RETRY_AFTER_SECONDS` (60s)**: past that, the retry stops and the `429` is returned to the caller, which each service turns into an ordinary error. This cap is not theoretical — during verification of the playlist-cleanup feature the account hit the Development Mode quota and Spotify answered with `Retry-After: 6493` (~108 minutes). Honoring that verbatim (the previous behavior) parked the request thread for the full duration: the request never returned, the page spun forever with no error, and the wedged threads even prevented `uvicorn --reload` from restarting its worker. With the cap, the same rate-limited request now fails in ~0.09s with a logged warning and a `502` the UI can report.
- Playback router catches exceptions but returns tuple-like payloads in success status path tests; error branches currently return HTTP 200 with error message text rather than 4xx/5xx.
- **Rate limiting is reported, not swallowed.** `http_client` raises a typed `SpotifyRateLimitedError` whenever a 429 survives the retry budget *or* carries a `Retry-After` past the cap; `_call()` normalizes both outcomes (previously one returned a plain response and the other surfaced tenacity's opaque `RetryError`). Every router maps it to **HTTP 429** with a plain-language message, and maps other Spotify failures to **502**. This matters more than it sounds: an unhandled exception returns a bare `500` that `CORSMiddleware` never annotates, so the browser reports a misleading *"blocked by CORS policy"* error instead of the real cause. Observed live — `/api/playlists/`, `/api/songs/` and `/api/songs/total` all did exactly this during a rate limit, and the frontend's catch-all then rendered "No uncategorized songs found. All your liked songs are already in playlists!", telling the user their library was empty when the request had simply failed.
- **Spotify rate limits per endpoint, not per app.** Verified live: `/me/playlists` returned `429` with `Retry-After: 3858` while `/me/tracks` and `/me/top/tracks` both returned `200` in the same moment. Because nearly every request path calls `get_created_playlists()` (→ `/me/playlists`) — including `/api/playlists/`, the uncategorized index build, and `_find_owned_playlist` on *every* playlist-cleanup request — one limited endpoint takes the whole app down. Worth keeping in mind when diagnosing: "nothing loads" can mean one endpoint is limited, not that the account or token is broken.

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

## Playlist-songs and listening-affinity services (new)

Added for the playlist-cleanup feature.

- **Removal endpoint discrepancy (verified live)**: Spotify's public reference
  for removing playlist items still documents the older `/tracks` endpoint,
  whose body key is `tracks` (`{"tracks": [{"uri": ...}]}`). This app's
  `/tracks` calls 403 (as `CLAUDE.md` already recorded for reads). The
  endpoint that actually works is `DELETE /v1/playlists/{id}/items`, but it
  uses a **different body key**: `{"items": [{"uri": ...}]}` — the `items`
  endpoint rejects the `tracks`-keyed body with `400 "No uris provided"`.
  Verified against a throwaway playlist: created it, added two tracks,
  removed one with the `items`-keyed body, confirmed only the other
  remained, then deleted the playlist. `snapshot_id` is deliberately omitted
  from the removal request — the playlist's cached state that triggers a
  removal may be minutes old, and sending a snapshot from it risks rejecting
  a removal against a playlist that changed elsewhere in the meantime.
  Removing a track removes **every occurrence** of it in the playlist —
  Spotify addresses removal by URI, not position.
- **`playlist_songs_service.py`**: fetches a playlist's full song list (id,
  name, artists, album, art, `added_at`) using a richer `fields` projection
  than the uncategorized-index build's ID-only one —
  `items(added_at,item(id,name,artists(name),album(name,images))),next,total`
  — verified live to return populated data. Reuses
  `playlists_service.PlaylistIntegrityError` for the same failure mode: a
  non-zero `total` with zero extracted songs raises rather than returning an
  empty list. Cached in memory per playlist ID with a 5-minute freshness
  window (no runtime file); a successful removal invalidates that playlist's
  entry directly. Ordering (`playlist`/`added_asc`/`added_desc`/`affinity_asc`)
  is computed over the *entire* playlist before pagination, not per-page —
  `affinity_asc` sorts ascending by tier, breaking ties by oldest `added_at`
  so the songs surfaced first are both unlistened-to and longest held.
- **`affinity_service.py`**: Spotify exposes no per-track play count. The
  nearest real signal is `GET /me/top/tracks`, which returns at most 50
  tracks per time range (`short_term`≈4wk, `medium_term`≈6mo,
  `long_term`≈1yr+) with no way to page past 50. The service fetches all
  three concurrently and reduces them to a `{track_id: tier}` map: tier 3 =
  in `short_term`, 2 = `medium_term` only, 1 = `long_term` only, 0 = in none
  — the dominant case for any playlist much larger than the ~150-track
  ceiling this signal can cover. Requires the `user-top-read` scope; checked
  from `token_service.get_granted_scopes()` (parses the token's stored
  `scope` field) *before* spending a request, not inferred from a 403 — this
  app already overloads 403 elsewhere ("playlist unreadable"), so relying on
  it here would make a stale scope and a quota problem indistinguishable.
  Cached the same way as the uncategorized index (versioned envelope,
  atomic write, in-memory copy validated by mtime, single-flight build via
  `threading.Event`), but with one deliberate difference: a stale affinity
  cache (24h window) triggers a **synchronous** rebuild rather than
  serve-stale-then-background — the rebuild costs only 3 requests, so
  there's no reason to serve day-old tiers when refreshing is this cheap. A
  failed refresh keeps whatever was cached rather than discarding it.
- **`songs_service.mark_index_stale()`**: rewrites the uncategorized index's
  `built_at` to the epoch while preserving `songs`. Called after a
  successful playlist-song removal, since that can make a liked song
  uncategorized again; the existing 15-minute freshness machinery then
  handles the rebuild — the request that triggered the removal is never
  blocked on it.

## 5. Frontend Behavior

Core frontend constants: `ui/src/utils/config.ts`

Notable endpoints include trailing slashes for some routes:
1. `POST_TOKEN_ENDPOINT = .../api/oauth/`
2. `GET_SONGS_ENDPOINT = .../api/songs/`
3. `GET_PLAYLISTS_ENDPOINT = .../api/playlists/`
4. Others are non-trailing slash (`/total`, `/add-song`, `/start`, `/stop`, `/logout`).
5. `getPlaylistSongsEndpoint(playlistId)` (new) — a function, not a constant, since the playlist ID is dynamic. GET and DELETE share the same URL; GET takes `offset`/`limit`/`sort` as query params, DELETE takes `{songId}` as its body.
6. `SCOPES` gained `user-top-read` — every pre-existing session's token lacks it until the user logs out and back in (see §9).

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
5. (new) Optional `onRemove(songId)` prop renders a trash control with an accessible name naming the song; nothing else about the card changes. Used only from the cleanup page.

## Clean playlist pages (new)

- `/clean`: lists owned playlists via the same `PlaylistList` component and `PlaylistsProvider` context as everywhere else — pinning and pinned-first ordering apply automatically. `PlaylistList` gained an optional `onSelectPlaylist(playlist)` prop that turns the row label into a button (`router.push('/clean/' + playlist.id)`); the pin toggle keeps its existing `stopPropagation` so pinning never navigates. Loading, empty (owns no playlists), and error+retry states are handled directly on the page. The retry action needed a `refetch()` added to `PlaylistsContext` — a small additive extension of `playlists-provider.tsx`; `fetchPlaylists` now also sets `loading` at the start of every call (not just the initial mount) so a retry shows a loading state too.
- `/clean/[playlistId]`: fetches one page of the playlist's songs from the new endpoint, renders each with `SongCard`, and offers a sort control (four options, `affinity_asc` shown but disabled with an explanatory line when the response's `affinity.available` is `false`), pagination, and page-size selection modeled on `/organize`. Also wrapped in `PlaylistsProvider` — `SongCard`'s "add to playlists" dialog is reused wholesale here, not just its layout, so it needs a live provider to be functional.
  - **Removal is deferred client-side.** Clicking the trash control adds the song's ID to a `pendingRemovalIds` set (the displayed list is `songs.filter(s => !pendingRemovalIds.has(s.id))` — the raw fetched list is never mutated, so undo restores exact position by construction rather than by tracking an index) and starts a 5-second `setTimeout`. The actual `DELETE` fires only when that timer elapses. Undo clears the timer; the request is never sent.
  - **Undo affordance** is a toast: `showToast(message, 'success', {durationMs: 5000, progress: true, action: {label: 'Undo', onClick: ...}})`. The toast's own auto-dismiss duration matches the removal timer exactly, so the progress bar and the actual deadline never disagree.
  - **`ToastProvider` gained an optional third argument** to `showToast` (`durationMs`, `action`, `progress`) and now also exposes `dismiss` and returns the new toast's ID from `showToast`. Existing two-argument call sites are unaffected. The progress bar is a state-driven width recomputed on a 100ms interval rather than a CSS keyframe animation, so `motion-reduce:transition-none` removes only the interpolating transition between ticks — remaining time is still conveyed via the discrete updates, satisfying "conveyed but not animated" under reduced motion.
  - **Flush on unload**: a single effect registers a `pagehide` listener and returns a cleanup function; both call the same `flushAllPending()`, which fires a `keepalive: true` `fetch` for every still-pending timer and clears them. `pagehide` covers a hard close/reload; the effect's own cleanup (on unmount or when `playlistId` changes) covers SPA navigation away. This is the only way a pending removal is guaranteed to reach Spotify rather than being silently dropped.
  - **Emptied later page**: an effect watching the displayed (filtered) list's length steps back a page automatically if a removal empties a page other than the first, so the user is never left staring at nothing.
  - **Failure handling**: a failed removal removes the ID from `pendingRemovalIds` (the song reappears) and shows an error toast; a `403` gets its own "could not be modified" message rather than the generic one.

## 6. Data Models and Type Contracts

Backend schema models (`api/app/models/schemas.py`):
1. `Code { code: str, redirect_uri: str (non-empty) }`
2. `Pagination { offset: int, limit: int }` (currently unused by router methods)
3. `SongPostData { songId: str, playlistIds: list[str] }`
4. `PlaybackModel { songId: str }`
5. `PinPostData { playlistId: str (non-empty), pinned: bool }`
6. `RemoveSongData { songId: str (non-empty) }` (new)

Frontend types (`ui/src/types/spotify.d.ts`):
- `Song` includes fields not returned by backend (`duration_ms`, `explicit`, `preview_url`, `track_number`, `popularity`, `external_urls`), while backend primarily returns:
1. `id`
2. `name`
3. `artists`
4. `album`
5. `album_pic_url`
- `Playlist` aligns with backend shape.
- `PlaylistSong` (new): deliberately *not* an extension of `Song` — built directly from what `GET /api/playlists/{id}/songs` actually returns (`id`, `name`, `artists`, `album`, `album_pic_url`, `added_at`, `affinity_tier`), so it doesn't inherit `Song`'s existing gap of claiming fields the backend never sends.

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

No new environment variables were introduced by the playlist-cleanup feature. The requested OAuth scope set (`SCOPES` in `config.ts`) gained `user-top-read`, which is a code change, not a config one — but it means every session whose token predates this change lacks the scope until the user logs out and back in (see §9).

Deployment config:
- `render.yaml` defines one Python web service (`rootDir: api`) with env vars above.

## 8. Test Coverage and Current Test Status

## Backend tests
- Present: `api/tests/` with 17 files and 207 test functions (added `test_service_affinity.py`, `test_service_playlist_songs.py`; extended `test_service_token.py` (`get_granted_scopes`), `test_service_playlists.py` (`remove_song_from_playlist`), `test_service_songs.py` (`mark_index_stale`), `test_service_http_client.py` (`spotify_delete`), `test_router_playlists.py` (both new endpoints), `test_router_oauth_logout.py` (the new managed file) for the playlist-cleanup feature).
- Scope includes routers, services, model schema construction, OAuth logout behavior, token refresh logic, and threading-timing paths tested with `threading.Event`/`Barrier` synchronization rather than real sleeps — including the new affinity build's single-flight coordination, which mirrors the uncategorized index's pattern.
- Local execution: `cd api && python3 -m pytest` (via `venv/bin/python -m pytest`) — 207 passed, 99% overall statement coverage (`playlist_songs_service.py` 100%, `affinity_service.py` 99%, `playlists_service.py` 99%, `songs_service.py` 98%, `routers/playlists.py` 97%), above the project's 90% target. The 13 uncovered lines are pre-existing defensive edge cases (a file vanishing mid-read between `stat` and `open`; cleanup-of-cleanup failure paths; one pre-existing router branch) rather than anything new.

## Frontend tests
- Present: 28 Jest test files under `ui/src` (added `app/clean/page.test.tsx`, `app/clean/layout.test.tsx`, `app/clean/[playlistId]/page.test.tsx`, `app/clean/[playlistId]/layout.test.tsx`; extended `toast-provider.test.tsx` (action/progress), `playlist-list.test.tsx` (`onSelectPlaylist`), `song.test.tsx` (`onRemove`), `playlists-provider.test.tsx` (`refetch`), `page.test.tsx` (the new landing-page entry point)).
- Local execution command: `npm test -- --runInBand`.
- Result:
1. 28 suites total.
2. 28 passed.
3. 0 failed.
4. 136 tests total: 136 passed, 0 failed.
- Coverage (`npm test -- --coverage`): ~96% statements / ~88% branches / ~94% functions / ~97% lines, above the enforced 85% `jest.config.js` threshold. Weakest spots remain pre-existing (`app/organize/page.tsx` pagination-link edge cases, `playlist-list.tsx`'s FLIP-animation branch, `select.tsx`/`dialog.tsx` shadcn internals) — nothing newly added by this feature meaningfully lowered the floor.

Non-fatal test console warnings currently observed:
- DOM nesting warning in `layout.test.tsx` (`<html>` inside RTL container) — expected, since that's the one place in the app the real `<html>` tag renders.

## 9. Key Gaps and Risks (As of This Snapshot)

1. File-based state and single-user assumptions remain.
2. Playback error handling returns success HTTP status in failure branches.
3. Logout client flow has no explicit error handling around failed network call before route push (documented by an `app-shell.test.tsx` case).
4. Runtime artifact files are currently untracked but not ignored (`api/user_id.json`, `api/all_uncategorized_songs.json`).
5. No playlist search/filter in the add-to-playlist dialog — with a large playlist library, pinning only helps the top few; deferred from the audit remediation as a feature, not a fix.
6. Process-level state (the in-memory index cache, cold-build coordination, background-refresh guard, **and now the affinity cache and the per-playlist song cache**) assumes a single backend worker — see `songs_service.py` note in §4. `render.yaml` and local dev both run one worker today, so this holds, but it's an assumption to keep in mind before scaling the backend horizontally.
7. **(new)** `user-top-read` was added to the requested scope set after existing sessions already had tokens. Every session established before this change lacks the scope and must log out and back in once before least-listened sorting becomes available; the app degrades gracefully in the meantime (the option is shown but disabled, with an explanation) rather than breaking.
8. **(new)** The listening-affinity signal is inherently coarse: Spotify's `/me/top/tracks` caps at 50 tracks per time range with no way to page further, so at most ~150 distinct tracks across all three ranges carry any signal at all. Any playlist larger than that will have most of its songs share the lowest tier (0), making `added_at` the real tiebreaker in practice — this is a property of the data Spotify exposes, not an implementation shortcut, and is called out in the UI copy and the spec.

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
