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
- `services/` — `token_service.py`, `songs_service.py`, `playlists_service.py`, `pins_service.py`, `playback_services.py`, `users_services.py`, `http_client.py`
- `models/schemas.py` — Pydantic models: `Code`, `Pagination`, `SongPostData`, `PlaybackModel`, `PinPostData`

### Frontend Structure (`ui/src/`)
- `app/` — pages: `/` (landing), `/login`, `/callback`, `/organize`
- `components/` — `playlists-provider.tsx` (shared playlist + pin state)
- `components/ui/` — SongCard, PlaylistList + shadcn/ui components
- `types/spotify.d.ts` — TypeScript interfaces (Song, Playlist)
- `utils/config.ts` — API endpoint constants + OAuth scopes
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
| PUT | `/api/playback/start` | Start playback |
| PUT | `/api/playback/stop` | Stop playback |

### Key Behaviors
- Single-user, file-based state: `token.json`, `user_id.json`, `all_uncategorized_songs.json`, `pinned_playlists.json`
- HTTP calls go through `http_client.py` (`spotify_get`/`spotify_post`), sharing one `requests.Session` sized to `CONCURRENCY_CEILING` (8); tenacity retries on 429, honoring `Retry-After` when Spotify sends it and falling back to exponential backoff otherwise; playback uses raw `requests.put`
- Token refresh buffer: 60s before expiry
- Uncategorized-songs index (`songs_service.py`): stored as a versioned envelope (`{"version": 2, "built_at": ..., "songs": [...]}`, written atomically via `os.replace`) rather than a bare array; a bare-array or unparseable file is treated as absent and rebuilt with no error surfaced. A process-level in-memory copy (validated by file mtime) serves paginated reads without re-parsing. Cold builds fan liked-song pages and each owned playlist's item pages out concurrently across one shared 8-way pool (`CONCURRENCY_CEILING`, from `http_client.py`); playlist reads request `fields=items(item(id)),next,total` to transfer track IDs only. Concurrent cold requests join a single in-progress build via an `Event` rather than polling. An index older than 15 minutes (`_FRESHNESS_WINDOW_SECONDS`) is still served immediately, with a background rebuild kicked off behind it (single-flight); `POST /api/songs/refresh` forces a synchronous rebuild regardless of freshness. Filing a song (`remove_song_from_index`) corrects the stored index in place and preserves its `built_at` rather than rebuilding.
- `playlists_service.get_playlist_songs()` raises `PlaylistIntegrityError` — never treated as an ordinary per-playlist failure — when a playlist reports tracks but the filtered response yields no IDs, since that pattern means the Spotify `fields` expression broke, not that the playlist is empty; letting it propagate is what stops a broken build from silently reporting the user's whole library as uncategorized.
- `playlists_service.add_song_to_playlists()` uses a `ThreadPoolExecutor` sized to `CONCURRENCY_CEILING` (8), same as the index build
- `pins_service.apply_pins()` orders playlists pinned-first via a single-pass stable partition, preserving relative order within each group; stale pinned IDs (playlist no longer exists) are ignored
- `PlaylistsProvider` (frontend) owns the playlist list and pin toggling for the whole `/organize` page, so every rendered `SongCard`'s add-to-playlist dialog shares one pinned state and reorders together
- Frontend auth gating via `sessionStorage.token_expiry` in `layout.tsx`
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
# Frontend (20 suites, 81 tests)
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
1. Runtime artifacts `api/user_id.json` and `api/all_uncategorized_songs.json` are not in `.gitignore` (`api/token.json` and `api/pinned_playlists.json` are)
2. Playback error handling returns HTTP 200 on failure branches
3. Frontend Song type includes fields the backend doesn't return
4. `ui/src/styles/globals.css` appears to be a legacy duplicate of `ui/src/app/globals.css`
5. Process-level state (in-memory index cache, build coordination) assumes a single backend worker process — `render.yaml` and local dev both run one, but adding workers would let each build its own index independently

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
- **Current approach**: Glassmorphism with green-to-blue gradients, frosted white cards, pill buttons — this works well for light mode and should be preserved there
- **Theme**: Support both light and dark mode with a toggle. Dark mode should lean into Spotify's dark palette; light mode keeps the current airy glassmorphism
- **Typography**: IBM Plex Mono throughout (already in place) — reinforces the technical/utility character
- **Components**: shadcn/ui + Radix primitives, Tailwind CSS, lucide-react icons

### Design Principles
1. **Album art is the hero** — Let cover art drive visual interest. UI chrome should support, not compete with, album imagery.
2. **Every action should feel satisfying** — Categorizing a song is the core loop. Use motion, color, and feedback to make it feel rewarding.
3. **Spotify-native, not Spotify-clone** — Draw from Spotify's visual language (dark mode, green accents, bold type) but maintain independent identity through the glassmorphism style and gradient palette.
4. **Fast and focused** — This is a utility tool. Keep interactions tight, minimize clicks, and never make the user wait without clear feedback.
5. **Accessible by default** — Support reduced motion, maintain WCAG AA contrast ratios, and ensure keyboard navigability across both themes.
