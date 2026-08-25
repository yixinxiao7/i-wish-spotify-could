# CLAUDE.md

## Project Overview

**i-wish-spotify-could** — A personal Spotify utility web app for categorizing liked songs that aren't in any playlist. Users log in via Spotify OAuth, browse uncategorized songs with in-app playback, and assign them to playlists.

## Architecture

- **Backend** (`api/`): FastAPI 0.115 + Python 3, Uvicorn
- **Frontend** (`ui/`): Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Auth**: Spotify OAuth 2.0 authorization code flow, tokens stored server-side

### Backend Structure (`api/app/`)
- `main.py` — entry point, CORS, router registration (`redirect_slashes=False`)
- `routers/` — `oauth.py`, `songs.py`, `playlists.py`, `playback.py`
- `services/` — `token_service.py`, `songs_service.py`, `playlists_service.py`, `playlist_songs_service.py`, `affinity_service.py`, `pins_service.py`, `playback_services.py`, `users_services.py`, `http_client.py`
- `models/schemas.py` — Pydantic models: `Code`, `Pagination`, `SongPostData`, `PlaybackModel`, `PinPostData`, `RemoveSongData`

### Frontend Structure (`ui/src/`)
- `app/` — pages: `/` (landing), `/login`, `/callback`, `/organize`, `/clean`, `/clean/[playlistId]`
- `components/` — `app-shell.tsx` (server/client layout split), `playlists-provider.tsx` (shared playlist + pin state), `toast-provider.tsx` (shared toast host — action buttons + depleting progress bar)
- `components/ui/` — SongCard, PlaylistList, SongListPagination + SongCardSkeleton (shared by both paged song lists), + shadcn/ui components
- `types/spotify.d.ts` — TypeScript interfaces (Song, Playlist, PlaylistSong)
- `utils/config.ts` — API endpoint constants + OAuth scopes
- `utils/pagination.ts` — pure offset/page-clamping and numbered-page-list helpers shared by both paged song lists
- `utils/playlists.ts` — `sortPinnedFirst` ordering helper

### API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/oauth/` | Exchange auth code for token |
| DELETE | `/api/oauth/logout` | Clear server-side state files |
| GET | `/api/songs/` | Paginated uncategorized songs (`offset`/`limit`) |
| GET | `/api/songs/total` | Count from cache |
| POST | `/api/songs/refresh` | Force the uncategorized-songs index to rebuild now, ignoring freshness |
| GET | `/api/playlists/` | User-owned playlists, pinned-first, each with a `pinned` flag |
| POST | `/api/playlists/add-song` | Add song to playlists, remove from cache |
| GET | `/api/playlists/pins` | Pinned playlist IDs |
| POST | `/api/playlists/pin` | Pin or unpin a playlist |
| GET | `/api/playlists/{playlist_id}/songs` | One page of a playlist's songs (`offset`/`limit`/`sort`), plus its total and the listening-affinity availability block |
| DELETE | `/api/playlists/{playlist_id}/songs` | Remove a song from a playlist by ID (body `{songId}`) |
| PUT | `/api/playback/start` | Start playback |
| PUT | `/api/playback/stop` | Stop playback |

### Key Behaviors
- Single-user, file-based state: `token.json`, `user_id.json`, `all_uncategorized_songs.json`, `pinned_playlists.json`, `track_affinity.json`
- HTTP calls go through `http_client.py` (`spotify_get`/`spotify_post`/`spotify_delete`), sharing one `requests.Session` sized to `CONCURRENCY_CEILING` (8); tenacity retries on 429, honoring `Retry-After` when Spotify sends it and falling back to exponential backoff otherwise; playback uses raw `requests.put`. The honored wait is capped at `MAX_RETRY_AFTER_SECONDS` (60s) — Development Mode quota can answer with a `Retry-After` of hours, and honoring that verbatim parks the request thread for the whole time (observed live: 6493s), so past the cap the retry stops and the 429 is surfaced to the caller as an ordinary error instead.
- Token refresh buffer: 60s before expiry
- Uncategorized-songs index (`songs_service.py`): stored as a versioned envelope (`{"version": 2, "built_at": ..., "songs": [...]}`, written atomically via `os.replace`) rather than a bare array; a bare-array or unparseable file is treated as absent and rebuilt with no error surfaced. A process-level in-memory copy (validated by file mtime) serves paginated reads without re-parsing. Cold builds fan liked-song pages and each owned playlist's item pages out concurrently across one shared 8-way pool (`CONCURRENCY_CEILING`, from `http_client.py`); playlist reads request `fields=items(item(id)),next,total` to transfer track IDs only. Concurrent cold requests join a single in-progress build via an `Event` rather than polling. An index older than 15 minutes (`_FRESHNESS_WINDOW_SECONDS`) is still served immediately, with a background rebuild kicked off behind it (single-flight); `POST /api/songs/refresh` forces a synchronous rebuild regardless of freshness. Filing a song (`remove_song_from_index`) corrects the stored index in place and preserves its `built_at` rather than rebuilding. `mark_index_stale()` rewrites `built_at` to the epoch while preserving `songs`, so a removal made from the playlist-cleanup feature triggers exactly one background rebuild via the same freshness machinery rather than a synchronous one.
- `playlists_service.get_playlist_songs()` raises `PlaylistIntegrityError` — never treated as an ordinary per-playlist failure — when a playlist reports tracks but the filtered response yields no IDs, since that pattern means the Spotify `fields` expression broke, not that the playlist is empty; letting it propagate is what stops a broken build from silently reporting the user's whole library as uncategorized. The same guard covers `playlist_songs_service.fetch_all_playlist_songs()`'s richer projection.
- `playlists_service.add_song_to_playlists()` uses a `ThreadPoolExecutor` sized to `CONCURRENCY_CEILING` (8), same as the index build. `playlists_service.remove_song_from_playlist()` calls `DELETE /v1/playlists/{id}/items` with body `{"items": [{"uri": ...}]}` — note this differs from Spotify's still-published `/tracks` reference, which uses a `tracks` key; `/items` rejects that shape with `400`. `/tracks` itself 403s for this app. Removal omits `snapshot_id` deliberately so it always applies against the playlist's current state.
- `playlist_songs_service.py` fetches a playlist's full song list (id, name, artists, album, art, `added_at`) with an in-memory per-playlist cache (5-minute freshness, no runtime file), and orders it by `playlist`/`added_asc`/`added_desc`/`affinity_asc` before paginating — ordering is computed over the whole playlist, not just the returned page. `affinity_asc` sorts ascending by tier, breaking ties by oldest `added_at`.
- `affinity_service.py` derives a 4-tier listening-affinity signal (0–3) from `GET /me/top/tracks` across its three time ranges, unioned; a track in none of them is tier 0. Requires the `user-top-read` scope — checked from the stored token's `scope` field before spending a request, not inferred from a 403. Cached as a versioned envelope (`track_affinity.json`, 24h freshness), same pattern as the uncategorized index, but refreshes synchronously rather than serving stale-then-background — the map is cheap (3 requests) so there's no reason to serve day-old tiers when a rebuild is this cheap. A failed refresh keeps the previous cache rather than discarding it.
- `pins_service.apply_pins()` orders playlists pinned-first via a single-pass stable partition, preserving relative order within each group; stale pinned IDs (playlist no longer exists) are ignored
- `PlaylistsProvider` (frontend) owns the playlist list and pin toggling for both `/organize` and `/clean/[playlistId]` (via `SongCard`'s "add to playlists" dialog), so every rendered `SongCard`'s dialog shares one pinned state and reorders together. Also exposes `refetch()` for a "try again" action after a failed load.
- Playlist-cleanup removal (frontend, `/clean/[playlistId]`) is deferred: clicking the trash control hides the row and starts a 10s timer: the `DELETE` request fires only when it elapses. Undo clears the timer so the request is never sent. The undo affordance is a toast action with a depleting progress bar (`ToastProvider`'s `durationMs`/`action`/`progress` options) whose duration matches the removal timer exactly. Both timers pause together while the user hovers or keeps focus anywhere inside the toast (`ToastOptions.onPauseChange`, wired to the page's own per-song timer via `pauseRemovalTimer`/`resumeRemovalTimer`), so the window can't run out while someone is mid-reach for Undo — a WCAG 2.2.1 requirement, not just a nicety. A pending removal is flushed (via `fetch(..., {keepalive: true})`) on `pagehide` and on the page component's unmount, so navigating away or closing the tab carries it out rather than dropping it — a paused timer is still flushed this way, since the DELETE hasn't been cancelled, only delayed.
- Frontend auth gating via `sessionStorage.token_expiry` in `layout.tsx`
- Rate limits surface as a typed `SpotifyRateLimitedError` from `http_client`, which every router maps to **HTTP 429** with a plain-language message (other Spotify failures map to 502). Routers must never let a Spotify exception go unhandled: a bare 500 isn't annotated by `CORSMiddleware`, so the browser reports a misleading "blocked by CORS policy" error instead of the real cause, and the frontend's catch-all then renders its empty state — telling the user their library is empty when the request merely failed. Note Spotify rate limits **per endpoint**: `/me/playlists` can be limited while `/me/tracks` still succeeds, and since almost every path calls `get_created_playlists()`, that one endpoint being limited looks like a total outage.
- Some routes use trailing slashes (`/api/oauth/`, `/api/songs/`, `/api/playlists/`), others don't

## Development Commands

### Run backend
```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Run frontend
```bash
cd ui
npm install
npm run dev
```

### Run tests
```bash
# Frontend (28 suites, 136 tests)
cd ui && npm test -- --runInBand

# Backend (requires pytest in env)
cd api && python3 -m pytest
```

## Environment Variables

### Backend (`api/app/routers/.env`)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URIS` — comma-separated allowlist of redirect URIs the token exchange (`POST /api/oauth/`) will accept; falls back to the single-URI `SPOTIFY_REDIRECT_URI` when unset
- `FRONTEND_URL` (optional, extends CORS allowlist)

### Frontend (`ui/.env.local`)
- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`, `NEXT_PUBLIC_WEB_HOST` (no longer drives the OAuth redirect URI — that's derived from `window.location.origin` at login time), `NEXT_PUBLIC_SERVER_HOST`

## Known Gaps
1. Runtime artifacts `api/user_id.json` and `api/all_uncategorized_songs.json` are not in `.gitignore` (`api/token.json`, `api/pinned_playlists.json`, and `api/track_affinity.json` are)
2. Playback error handling returns HTTP 200 on failure branches
3. Frontend Song type includes fields the backend doesn't return
4. Process-level state (in-memory index cache, build coordination, the affinity cache, and the per-playlist song cache) assumes a single backend worker process — `render.yaml` and local dev both run one, but adding workers would let each build its own index/cache independently
5. `user-top-read` was added to the requested OAuth scope set after existing sessions were already granted tokens; every session established before this scope existed must log out and back in once before listening-affinity sorting becomes available — the app degrades gracefully in the meantime rather than breaking

## Conventions
- Prefer small, focused changes; preserve existing style
- Update `CONTEXT.md` when behavior or contracts change
- If `CONTEXT.md` and code disagree, trust the code
- Runtime JSON files are local state, not feature output — treat accordingly
- Make sure to test all new/updated code for edge cases. Aim for at least 90% code coverage whereever possible.
- **Architecture diagram**: When any change affects the system architecture — new/removed/renamed endpoints, services, routers, pages, external integrations, deployment targets, or data flow — update `architecture.svg` at the project root to reflect the current state. The SVG is hand-authored inline XML; edit it directly (no build tools needed).

## Design Context

### Users
Spotify power users who have accumulated many liked songs that aren't organized into playlists. They care about their music library and want a fast, satisfying way to triage uncategorized tracks. They use this tool in focused sessions — browsing, previewing, and sorting songs one by one.

### Brand Personality
**Bold, expressive, vibrant.** The app is an extension of the Spotify ecosystem — it should feel native to that world while adding its own character. Confident and colorful, not corporate.

### Emotional Goals
- **Satisfaction & control**: The core feeling of finally getting a messy library organized. Every categorization action should feel decisive and rewarding.
- **Delight & discovery**: Browsing uncategorized songs resurfaces forgotten music. The interface should make this feel fun, not like a chore.

### Aesthetic Direction
- **Primary reference**: Spotify itself — dark backgrounds, bold green accents, album-art-forward, high contrast
- **Current approach**: Flat, opaque surfaces (`--card`, tinted toward the brand hue rather than pure white/near-black) with a solid Spotify-green fill on primary actions and pill buttons. No gradients and no `backdrop-filter` glass anywhere — both were removed for accessibility (a gradient fill can't hold a WCAG 1.4.11 boundary at every point along it) and by explicit preference. A page-level container (`.surface-panel`) carries a heavier shadow than a repeated list row (`.surface-row`), so the two read as different things without a second color palette.
- **Theme**: Support both light and dark mode with a toggle. Dark mode leans into Spotify's dark palette; light mode keeps a light, airy surface — flat rather than glass.
- **Typography**: IBM Plex Mono throughout (already in place) — reinforces the technical/utility character
- **Components**: shadcn/ui + Radix primitives, Tailwind CSS, lucide-react icons

### Design Principles
1. **Album art is the hero** — Let cover art drive visual interest. UI chrome should support, not compete with, album imagery.
2. **Every action should feel satisfying** — Categorizing a song is the core loop. Use motion, color, and feedback to make it feel rewarding.
3. **Spotify-native, not Spotify-clone** — Draw from Spotify's visual language (dark mode, green accents, bold type) but maintain independent identity through flat, brand-tinted surfaces rather than imitating Spotify's own chrome.
4. **Fast and focused** — This is a utility tool. Keep interactions tight, minimize clicks, and never make the user wait without clear feedback.
5. **Accessible by default** — Support reduced motion, maintain WCAG AA contrast ratios for text (4.5:1) and interactive-control boundaries (3:1) in both themes, and ensure keyboard navigability throughout.
