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
