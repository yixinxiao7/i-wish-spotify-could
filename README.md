# i-wish-spotify-could

A personal Spotify utility web app for doing things Spotify's native UI doesn't support — currently: **categorizing uncategorized liked songs into playlists**.

Browse your liked songs that aren't in any playlist, preview them with in-app Spotify playback, and assign them to one or more playlists — all in one view.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI 0.115, Python 3, Uvicorn |
| Auth | Spotify OAuth 2.0 (authorization code flow) |

---

## Prerequisites

- Node.js + npm
- Python 3 + pip
- A [Spotify Developer App](https://developer.spotify.com/dashboard) with `http://localhost:3000/callback` added as a Redirect URI

---

## Setup

### 1. Backend environment

Create `api/app/routers/.env`:
```
SPOTIFY_CLIENT_ID=<your_client_id>
SPOTIFY_CLIENT_SECRET=<your_client_secret>
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

### 2. Frontend environment

Create `ui/.env.local`:
```
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=<your_client_id>
NEXT_PUBLIC_WEB_HOST=http://localhost:3000
NEXT_PUBLIC_SERVER_HOST=http://localhost:8000
```

---

## Running

### Backend
```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend
```bash
cd ui
npm install
npm run dev
```
App runs at `http://localhost:3000`.

---

## How It Works

1. **Log in** — Spotify OAuth 2.0 authorization code flow. The backend exchanges the code for a token and stores it server-side. Tokens are automatically refreshed when they expire.
2. **Organize** — Navigate to `/organize`. On first load the app fetches all your liked songs and all songs already in your playlists, computes the difference, and caches the result locally. This first fetch may take a moment.
3. **Preview** — Click the play button on any song card to start playback on your active Spotify device.
4. **Categorize** — Select one or more of your playlists and confirm. The song is added to those playlists and removed from the queue.

---

## Project Structure

```
i-wish-spotify-could/
├── api/                        # FastAPI backend
│   └── app/
│       ├── main.py             # Entry point, CORS, router registration
│       ├── models/schemas.py   # Pydantic request models
│       ├── routers/            # oauth, songs, playlists, playback
│       └── services/           # token_service, songs_service, playlists_service, etc.
└── ui/                         # Next.js frontend
    └── src/
        ├── app/                # Pages: /, /login, /callback, /organize
        ├── components/ui/      # SongCard + shadcn/ui components
        ├── types/              # TypeScript interfaces (Song, Playlist)
        └── utils/config.ts     # API endpoint constants + OAuth scopes
```

---

## Notes

- **Single-user only** — token and cache are stored as local JSON files (`token.json`, `user_id.json`, `all_uncategorized_songs.json`), all gitignored.
- **Active Spotify device required** for playback control — open Spotify on any device before using the play button.
- The uncategorized songs cache is only invalidated when you categorize a song. If your playlists change externally, delete `api/all_uncategorized_songs.json` to force a fresh compute.
