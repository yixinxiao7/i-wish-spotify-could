# Project Context — `i-wish-spotify-could`

> This document is intended to give a new agent full working context of the project.
> It covers purpose, architecture, file structure, data models, API contracts, user flows, and known limitations.

---

## UI Conventions

- **Text casing:** All UI-facing strings are intentionally **lowercase** (e.g. "home", "categorize songs", "coming soon..."). Do not capitalize these unless explicitly asked.
- **Color theme:** Primary gradient is green-to-cyan (`linear-gradient(90deg, #3fd15a, #5bc6f5)`), used on buttons and the navbar link.
- **Primary dark color:** `#134f55` (dark teal) — used for text strokes, headings, and accents.

---

## 1. Purpose

`i-wish-spotify-could` is a personal Spotify utility web app that lets a user do things Spotify's native UI doesn't support — currently: **categorizing uncategorized liked songs into playlists**.

The core workflow:
1. User logs in via Spotify OAuth.
2. The app computes which liked songs are not in any of the user's playlists (called "uncategorized songs").
3. The user browses those songs, previews them with in-app playback, and assigns them to one or more playlists.
4. The app removes the categorized song from the queue and moves to the next.

The landing page has a second button ("yeety!") that is a placeholder — it has no functionality yet.

---

## 2. Repository Structure

```
i-wish-spotify-could/
├── AUDIT.md                        # Security and quality audit report (see for issue history)
├── CONTEXT.md                      # This file
├── README.md
├── .gitignore                      # Ignores .env, token.json, user_id.json, all_uncategorized_songs.json
│
├── api/                            # Python FastAPI backend
│   ├── requirements.txt
│   ├── README.md
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # App entry point, CORS config, router registration
│       ├── models/
│       │   └── schemas.py          # Pydantic request body models
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── oauth.py            # POST /api/oauth — exchanges auth code for token
│       │   ├── songs.py            # GET /api/songs, GET /api/songs/total
│       │   ├── playlists.py        # GET /api/playlists, POST /api/playlists/add-song
│       │   └── playback.py         # PUT /api/playback/start, PUT /api/playback/stop
│       └── services/
│           ├── token_service.py    # get_valid_token() — reads token, auto-refreshes if expired
│           ├── users_services.py   # get_current_user_id()
│           ├── songs_service.py    # get_liked_songs(), get_uncategorized_songs(), get_total_uncategorized_songs()
│           ├── playlists_service.py# get_created_playlists(), get_playlist_songs(), add_song_to_playlists()
│           └── playback_services.py# toggle_playback()
│
└── ui/                             # Next.js 15 frontend (App Router)
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json               # strict mode enabled
    ├── components.json             # shadcn/ui config
    └── src/
        ├── utils/
        │   └── config.ts           # All API endpoint constants + OAuth scopes
        ├── types/
        │   ├── spotify.d.ts        # Song and Playlist TypeScript interfaces
        │   └── index.d.ts
        ├── lib/
        │   └── utils.ts            # shadcn utility (cn function)
        ├── components/
        │   ├── theme-provider.tsx
        │   └── ui/
        │       ├── song.tsx        # SongCard — the main interactive component
        │       ├── button.tsx      # shadcn/ui
        │       ├── card.tsx        # shadcn/ui
        │       ├── checkbox.tsx    # shadcn/ui
        │       ├── dialog.tsx      # shadcn/ui
        │       ├── pagination.tsx  # shadcn/ui
        │       └── select.tsx      # shadcn/ui
        └── app/
            ├── globals.css
            ├── styles/globals.css
            ├── favicon.ico
            ├── layout.tsx          # Root layout — client component, handles auth gating
            ├── page.tsx            # Landing page — "Categorize Songs" + placeholder button
            ├── login/
            │   └── page.tsx        # Initiates Spotify OAuth redirect
            ├── callback/
            │   ├── page.tsx        # Server component — exchanges code for token via backend
            │   └── ClientComponent.tsx  # Verifies OAuth state, writes token_expiry to sessionStorage, redirects
            └── organize/
                └── page.tsx        # Main app page — paginated song list with playlist assignment
```

---

## 3. Tech Stack

### Backend
| Technology | Version | Role |
|---|---|---|
| Python | 3.x | Runtime |
| FastAPI | 0.115.8 | Web framework |
| Uvicorn | 0.34.0 | ASGI server |
| Pydantic | 2.10.6 | Request validation / data models |
| requests | 2.32.3 | HTTP client for Spotify API calls |
| python-dotenv | 1.0.1 | Loads `.env` file |
| SQLAlchemy | 2.0.37 | Listed in requirements but not yet used |

### Frontend
| Technology | Version | Role |
|---|---|---|
| Next.js | 15.1.7 | React framework (App Router) |
| React | 19.0.0 | UI library |
| TypeScript | 5.x | Type system (strict mode) |
| Tailwind CSS | 3.4.1 | Styling |
| shadcn/ui | — | Component library (Radix UI primitives) |
| Jest | 29.7.0 | Test runner (configured, no tests written yet) |
| React Testing Library | 16.2.0 | Test utilities (installed, no tests written yet) |
| MSW | 2.7.0 | API mocking for tests (installed, no tests written yet) |

---

## 4. Environment Variables

### Backend (`api/app/routers/.env` — not committed)
```
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```
Loaded by `python-dotenv` at the top of `oauth.py` and `token_service.py` via `load_dotenv()`.

### Frontend (`ui/.env.local` — not committed)
```
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=<your_spotify_client_id>
NEXT_PUBLIC_WEB_HOST=http://localhost:3000
NEXT_PUBLIC_SERVER_HOST=http://localhost:8000
```
`NEXT_PUBLIC_*` variables are inlined at build time and exposed to the browser.
`NEXT_PUBLIC_SERVER_HOST` and `NEXT_PUBLIC_WEB_HOST` drive all API endpoint URLs in `config.ts`.

---

## 5. Running the Project

### Backend
```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
The server runs at `http://localhost:8000`. FastAPI auto-generates docs at `/docs`.

### Frontend
```bash
cd ui
npm install
npm run dev       # runs on http://localhost:3000 with Turbopack
npm test          # runs Jest (no test files exist yet)
```

---

## 6. Spotify OAuth Flow (End-to-End)

```
User clicks "Log in"
  └─ login/page.tsx
       └─ Generates a random 16-character state string
       └─ Stores state in sessionStorage['oauth_state']
       └─ Builds Spotify authorize URL with:
            - client_id (from NEXT_PUBLIC_SPOTIFY_CLIENT_ID)
            - response_type=code
            - redirect_uri=http://localhost:3000/callback
            - state=<stored state value>
            - scope=<see Section 7>
       └─ window.location.href = authUrl

Spotify redirects to http://localhost:3000/callback?code=<AUTH_CODE>&state=<STATE>
  └─ callback/page.tsx  (Next.js server component)
       └─ Reads searchParams.code and searchParams.state
       └─ POSTs code to backend: POST http://localhost:8000/api/oauth
            └─ oauth.py exchanges code for token via Spotify token URL
            └─ Writes full token response + expires_at to api/token.json (plaintext)
            └─ Returns { message, expires_in }
       └─ Renders <ClientComponent token_expires_in={expires_in} state={state} />

ClientComponent.tsx  (client component)
  └─ Reads sessionStorage['oauth_state']
  └─ If state param !== stored state → redirects to /login (CSRF protection)
  └─ Removes 'oauth_state' from sessionStorage
  └─ Writes sessionStorage['token_expiry'] = now + expires_in
  └─ router.push("/")

All subsequent routes
  └─ layout.tsx useEffect checks sessionStorage['token_expiry'] exists AND is in the future
  └─ If missing or expired and not on /login or /callback → redirect to /login
```

---

## 7. Spotify API Scopes

The app requests these OAuth scopes (defined in `ui/src/utils/config.ts`):
```
playlist-read-private        — read user's private playlists
playlist-modify-public       — add songs to public playlists
playlist-modify-private      — add songs to private playlists
user-read-currently-playing  — (unused in current code)
user-read-private            — read user profile
user-read-email              — read user email
user-library-read            — read liked songs
user-modify-playback-state   — control playback (play/pause)
```

---

## 8. Backend API Reference

All routes are prefixed under `http://localhost:8000`.

### Authentication
Token is stored in `api/token.json` after OAuth exchange, including an `expires_at` Unix timestamp. All subsequent backend API calls go through `get_valid_token()` in `token_service.py`, which auto-refreshes the token using the stored `refresh_token` if it has expired or is within 60 seconds of expiry.

---

### `POST /api/oauth`
Exchange Spotify authorization code for an access token.

**Request body:**
```json
{ "code": "<spotify_auth_code>" }
```

**Response (200):**
```json
{ "message": "successfully exchanged code for token.", "expires_in": 3600 }
```

**Response (502):** Generic error if Spotify token exchange fails (raw error is logged server-side only).

**Side effect:** Writes the full Spotify token response + `expires_at` to `api/token.json`:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "...",
  "expires_at": 1739999999
}
```

---

### `GET /api/songs?offset=0&limit=10`
Get a page of uncategorized songs.

**Query params:**
- `offset` (int, default 0, min 0)
- `limit` (int, default 10, min 1, max 100)

FastAPI returns `422` automatically if bounds are violated.

**Response (200):**
```json
{
  "songs": [
    {
      "id": "spotify_track_id",
      "name": "Song Name",
      "artists": "Artist One, Artist Two",
      "album": "Album Name",
      "album_pic_url": "https://..."
    }
  ]
}
```

**Internals:** On first call, fetches all liked songs and all user-created playlist songs from Spotify, computes the difference, and caches to `api/all_uncategorized_songs.json`. Subsequent calls read from the cache file.

---

### `GET /api/songs/total`
Get total count of uncategorized songs.

**Response (200):**
```json
{ "total": 142 }
```

**Note:** If called before `/api/songs` has created the cache file, this endpoint polls with `time.sleep(1)` up to a 30-second timeout, then raises an exception. Avoid calling this endpoint before `/api/songs` on first load.

---

### `GET /api/playlists`
Get all playlists owned by the current user (not followed, only created).

**Response (200):**
```json
{
  "playlists": [
    {
      "id": "spotify_playlist_id",
      "name": "Playlist Name",
      "owner_id": "spotify_user_id",
      "playlist_image_url": "https://..."
    }
  ]
}
```

**Internals:** Fetches all playlists from Spotify (`/v1/me/playlists`), then filters to those where `owner_id` matches the current user. User ID is cached in `api/user_id.json`.

---

### `POST /api/playlists/add-song`
Add a song to one or more playlists and remove it from the uncategorized cache.

**Request body:**
```json
{
  "songId": "spotify_track_id",
  "playlistIds": ["playlist_id_1", "playlist_id_2"]
}
```

**Response (200):**
```json
{ "message": "Song added to playlists successfully!" }
```

**Response (500):** `{ "detail": "Failed to add song to playlists" }` — raw exception is logged server-side only.

**Side effect:** Removes the song from `api/all_uncategorized_songs.json` after successfully adding it.

---

### `PUT /api/playback/start`
Start playback of a specific track on the user's active Spotify device.

**Request body:**
```json
{ "songId": "spotify_track_id" }
```

**Response (200):**
```json
{ "message": "Playback started successfully" }
```

**Note:** Requires an active Spotify device. If no device is active, Spotify returns a 404.

---

### `PUT /api/playback/stop`
Pause playback.

**Request body:**
```json
{ "songId": "spotify_track_id" }
```

**Response (200):**
```json
{ "message": "Playback stopped successfully" }
```

---

## 9. Frontend Pages and Components

### `layout.tsx` — Root Layout
- **Client component** (`"use client"`) — unusual for Next.js root layout, loses SSR metadata support.
- On mount, checks `sessionStorage['token_expiry']` exists **and** its value is greater than the current Unix timestamp. If expired or missing and not on `/login` or `/callback`, redirects to `/login`.
- Renders a top navbar with a "home" link (lowercase) and a footer.
- Navbar is `bg-transparent`. The "home" link uses a green-to-cyan gradient text (`#3fd15a → #5bc6f5`) with a dark teal text stroke (`#134f55`).

### `page.tsx` — Landing Page (`/`)
- Two buttons: "categorize songs" → `/organize`, and "coming soon..." (no action, placeholder).
- Buttons use the same green-to-cyan gradient (`#3fd15a → #5bc6f5`).

### `login/page.tsx` — Login Page (`/login`)
- Generates a random 16-character state string.
- Stores state in `sessionStorage['oauth_state']` before redirect.
- Redirects browser to Spotify OAuth authorize URL.

### `callback/page.tsx` + `ClientComponent.tsx` — OAuth Callback (`/callback`)
- Server component fetches the backend to exchange the code and reads `state` from `searchParams`.
- Passes `expires_in` and `state` to `ClientComponent` as props.
- `ClientComponent` verifies `state` against `sessionStorage['oauth_state']`; mismatches redirect to `/login`.
- On success, removes `oauth_state` from sessionStorage, writes `token_expiry` (Unix timestamp), redirects to `/`.

### `organize/page.tsx` — Organize Page (`/organize`)
- Fetches playlists, total song count, and first page of songs in parallel on mount.
- State: `songs`, `playlists`, `total`, `currentPage`, `offset`, `limit`, `loading`.
- Renders a list of `SongCard` components.
- Pagination: custom logic with previous/next and page number links (first page, current−1, current, current+1, last page pattern).
- Per-page limit selector: 10 / 25 / 50.
- Shows a centered spinner while loading.

### `components/ui/song.tsx` — `SongCard`
The main interactive component. Props:
```typescript
{
  id: string
  name: string
  artists: string
  album: string
  album_pic_url?: string
  onRefresh: () => void
  allPlaylists?: Playlist[]
  className?: string
}
```
- Displays album art as the play button background.
- Play/pause button calls `PUT /api/playback/start` or `PUT /api/playback/stop`.
- "Add to playlists" button opens a `Dialog` listing all user playlists with checkboxes and playlist images.
- On confirm, calls `POST /api/playlists/add-song` and calls `onRefresh()` to reload the song list.
- Uses `alert()` for all user feedback (no toast/snackbar system).

---

## 10. Data Models

### Backend — Pydantic (`api/app/models/schemas.py`)
```python
class Code(BaseModel):
    code: str                          # OAuth auth code

class Pagination(BaseModel):           # Defined but not used (songs router uses Query params instead)
    offset: int
    limit: int

class SongPostData(BaseModel):
    songId: str
    playlistIds: list[str]

class PlaybackModel(BaseModel):
    songId: str
```

### Frontend — TypeScript (`ui/src/types/spotify.d.ts`)
```typescript
interface Song {
    id: string;
    name: string;
    artists: string;       // pre-joined comma-separated string, not an array
    album: string;
    album_pic_url?: string;
    duration_ms: number;   // defined in type but not returned by backend
    explicit: boolean;     // defined in type but not returned by backend
    preview_url?: string;  // defined in type but not returned by backend
    track_number: number;  // defined in type but not returned by backend
    popularity: number;    // defined in type but not returned by backend
    external_urls: { spotify: string }; // defined in type but not returned by backend
}

interface Playlist {
    id: string;
    name: string;
    owner_id: string;
    playlist_image_url?: string;
}
```
**Note:** The `Song` interface has several fields (`duration_ms`, `explicit`, `preview_url`, `track_number`, `popularity`, `external_urls`) that the backend does not currently return. These are dead fields in the type definition.

---

## 11. File-Based State (Known Architecture Limitation)

The backend uses three JSON files on disk as its persistence layer. These are intentional short-term shortcuts with TODOs to replace with Redis/database:

| File | Contents | Created by | Read by |
|---|---|---|---|
| `api/token.json` | Full Spotify token response + `expires_at` Unix timestamp | `oauth.py` after OAuth exchange | `token_service.py` — `get_valid_token()` |
| `api/user_id.json` | `{ "id": "<spotify_user_id>" }` | `playlists_service.py` on first call | `playlists_service.py` to filter owned playlists |
| `api/all_uncategorized_songs.json` | Array of song objects | `songs_service.py` on first request | `songs_service.py` on all subsequent requests, `playlists.py` after add-song |

These files are gitignored. The app is designed for **a single user** — there is no multi-user support, session isolation, or token-per-user management.

---

## 12. Known Issues and TODOs

| Location | TODO |
|---|---|
| `oauth.py` | Change token storage from `token.json` to a token manager like Redis |
| `songs_service.py` | Implement proper in-memory cache to replace file-based cache |
| `playlists_service.py` | Add playlists to cache |
| `playlists.py` | Convert bare exceptions to proper HTTP responses (partially done — add-song now raises 500) |
| `playback.py` | Convert `action` string ("play"/"pause") to an enum |

---

## 13. What Is and Isn't Implemented

### Implemented
- Spotify OAuth login flow with CSRF state verification
- Token auto-refresh via `get_valid_token()` in `token_service.py` (60-second pre-expiry buffer)
- Fetching and displaying uncategorized liked songs (paginated, bounds-validated)
- Fetching user-owned playlists with images
- Adding a song to one or more playlists
- Removing a categorized song from the local cache
- In-app playback control (play/pause via Spotify Connect)
- Client-side auth gating via sessionStorage with real timestamp expiry check

### Not Implemented / Placeholder
- Logout
- The "yeety!" button on the landing page
- Any test coverage (test infrastructure is installed but no tests are written)
- Error UI (all errors use `alert()` or `console.error`)
- Multi-user support
- Rate limiting
- Structured logging
- API versioning
- Moving auth gating to Next.js middleware (would require sessionStorage → cookie migration)

---

## 14. Test Infrastructure

Test tooling is installed but no test files exist:

**Frontend (Jest + React Testing Library + MSW):**
- `npm test` runs Jest
- `npm run test:watch` runs Jest in watch mode
- MSW (`msw@2.7.0`) is available for API mocking
- Babel config is partially set up (`@babel/preset-env`, `@babel/preset-react`, `@babel/preset-typescript`)

**Backend (no test runner installed):**
- `pytest` is not in `requirements.txt`
- `httpx` is in `requirements.txt` (FastAPI's `TestClient` uses it)
- `SQLAlchemy` is in `requirements.txt` but unused — may have been added in anticipation of a database migration

---

## 15. Key Architectural Decisions (and Their Trade-offs)

| Decision | Rationale | Trade-off |
|---|---|---|
| File-based token/cache storage | Simple, no infrastructure needed | Not multi-user, race conditions, data loss on restart |
| Backend as Spotify proxy | Keeps client_secret server-side | All requests bottleneck through one token |
| `get_valid_token()` for all Spotify calls | Transparent token refresh without user intervention | Still file-based; not safe for concurrent multi-user access |
| Client-side auth gate (sessionStorage) | Simple to implement | Bypassable; no server-side session validation |
| Uncategorized songs computed at request time | No background job needed | First load is slow (fetches all liked songs + all playlist songs) |
| Result cached to JSON file | Avoids recomputing on every request | Cache is never invalidated automatically (only on song add) |
| `ThreadPoolExecutor(max_workers=10)` for multi-playlist add | Parallel Spotify writes with a cap | No timeout per future |
| Root layout as client component | Needed `useRouter`/`usePathname` for auth redirect | Loses Next.js SSR metadata, forces client bundle on layout |
