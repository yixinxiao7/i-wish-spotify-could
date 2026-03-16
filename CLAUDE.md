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
- `services/` — `token_service.py`, `songs_service.py`, `playlists_service.py`, `playback_services.py`, `users_services.py`, `http_client.py`
- `models/schemas.py` — Pydantic models: `Code`, `Pagination`, `SongPostData`, `PlaybackModel`

### Frontend Structure (`ui/src/`)
- `app/` — pages: `/` (landing), `/login`, `/callback`, `/organize`
- `components/ui/` — SongCard + shadcn/ui components
- `types/spotify.d.ts` — TypeScript interfaces (Song, Playlist)
- `utils/config.ts` — API endpoint constants + OAuth scopes

### API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/oauth/` | Exchange auth code for token |
| DELETE | `/api/oauth/logout` | Clear server-side state files |
| GET | `/api/songs/` | Paginated uncategorized songs (`offset`/`limit`) |
| GET | `/api/songs/total` | Count from cache |
| GET | `/api/playlists/` | User-owned playlists |
| POST | `/api/playlists/add-song` | Add song to playlists, remove from cache |
| PUT | `/api/playback/start` | Start playback |
| PUT | `/api/playback/stop` | Stop playback |

### Key Behaviors
- Single-user, file-based state: `token.json`, `user_id.json`, `all_uncategorized_songs.json`
- HTTP calls go through `http_client.py` (`spotify_get`/`spotify_post`) with tenacity retry on 429; playback uses raw `requests.put`
- Token refresh buffer: 60s before expiry
- `songs_service.get_total_uncategorized_songs()` waits up to 30s for cache file
- `playlists_service.add_song_to_playlists()` uses `ThreadPoolExecutor(max_workers=10)`
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
# Frontend (16 suites, 44 tests)
cd ui && npm test -- --runInBand

# Backend (49 test functions, requires pytest in env)
cd api && python3 -m pytest
```

## Environment Variables

### Backend (`api/app/routers/.env`)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- `FRONTEND_URL` (optional, extends CORS allowlist)

### Frontend (`ui/.env.local`)
- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`, `NEXT_PUBLIC_WEB_HOST`, `NEXT_PUBLIC_SERVER_HOST`

## Known Gaps
1. Runtime artifacts `api/user_id.json` and `api/all_uncategorized_songs.json` are not in `.gitignore`
2. Cache invalidation is partial — only updates on add-song; external playlist changes require manual cache file deletion
3. Playback error handling returns HTTP 200 on failure branches
4. Frontend Song type includes fields the backend doesn't return
5. `ui/src/styles/globals.css` appears to be a legacy duplicate of `ui/src/app/globals.css`

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
