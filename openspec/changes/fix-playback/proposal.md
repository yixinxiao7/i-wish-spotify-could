## Why

The play button on every `SongCard` does nothing on the live site, and the user is never told why. A live investigation (2026-10-29, against `i-wish-spotify-could-api.onrender.com`) found two independent faults that compound each other:

1. **Every failure is reported as success.** `api/app/routers/playback.py` returns `{"message": ...}, 500` from its error branches. FastAPI does not treat a returned tuple as `(body, status)` — it serializes it as a JSON array with **HTTP 200**. Observed live: Spotify answered a pause with `403 Player command failed: Restriction violated`, and the browser received `200 [{"message": "Error stopping playback: ..."}, 500]`. `SongCard` checks `response.ok`, so it flips to the "pause" icon and never shows its failure toast. No-device, Premium-required, and expired-token failures are all invisible the same way. (Known Gap #2.)
2. **Play requests target no device, and Spotify silently drops them.** `toggle_playback()` calls `PUT /v1/me/player/play` with no `device_id`. Observed live: Spotify returned `204` to the app's play request twice — once with nothing playing, once with a track already playing on the device Spotify itself listed as active — and neither time did the requested track start. The same command sent with an explicit `device_id` for that device played immediately.

A third, smaller fault sits behind the first: `get_valid_token()` runs outside the router's `try`, so a token-refresh failure escapes as a bare `500`, which `CORSMiddleware` does not annotate, so the browser reports a misleading CORS error (CONTEXT.md §4 / CLAUDE.md "Routers must never let a Spotify exception go unhandled").

## What Changes

**Backend**

- `toggle_playback()` resolves a target device before playing: `GET /v1/me/player/devices`, preferring the active, non-restricted device, falling back to the first non-restricted one. It passes that device as `?device_id=` on `play`. No usable device → a typed "no device" failure, not a request Spotify will drop.
- Device lookup needs the `user-read-playback-state` scope. When the stored token lacks it (every session granted before this change), playback falls back to today's untargeted request instead of failing — the same graceful-degradation pattern `affinity_service` uses for `user-top-read`.
- Playback calls move onto `http_client` (a new `spotify_put`), so they share the session, the 429 retry/`Retry-After` handling, and `SpotifyRateLimitedError`.
- Success is any `2xx`, not only `204` — Spotify documents `204` but also answers `202` while a device wakes.
- Spotify failures are raised as a typed `PlaybackError` carrying Spotify's status and `reason`, and the router maps them to real HTTP statuses with plain-language `detail` (design §3). Pausing an already-paused player (`403` restriction on `pause`) is treated as success, since the requested end state holds.
- `get_valid_token()` moves inside the router's error handling; a refresh failure becomes `401` "log in again", never a bare `500`.

**Frontend**

- `user-read-playback-state` is added to `SCOPES` in `ui/src/utils/config.ts`.
- `SongCard`'s playback toggle shows the backend's `detail` in its error toast when one is present, falling back to today's generic copy.

**Non-goals**

- No in-browser playback (Web Playback SDK). The app remains a remote control for the user's own Spotify device.
- No device picker UI. Device choice is automatic; the user's lever is opening Spotify on the device they want.
- No cross-card "now playing" state. Each card still tracks its own play/pause icon, as today.
- No retrying or "transfer playback" dance beyond passing `device_id`.

## Capabilities

### New Capabilities

- `playback`: Starting and stopping preview playback of a song on the user's own Spotify device, and reporting why when it cannot.

### Modified Capabilities

None. The requested OAuth scope set gains `user-read-playback-state`, but no `spotify-auth` requirement changes — the scope list is an implementation detail of satisfying `playback`'s device-targeting requirement, and sessions without it are covered by that requirement's degradation scenario.

## Impact

**Backend**
- `api/app/services/http_client.py` — `spotify_put`, same retry wrapper as `spotify_post`
- `api/app/services/playback_services.py` — device resolution, `PlaybackError`, 2xx success, `spotify_put`
- `api/app/routers/playback.py` — `HTTPException` mapping, token inside error handling
- `api/tests/test_service_playback.py`, `api/tests/test_router_playback.py`, `api/tests/test_service_http_client.py` — rewritten error-branch tests (the current ones assert the buggy `200`)

**Frontend**
- `ui/src/utils/config.ts` (+ `config.test.ts`) — new scope
- `ui/src/components/ui/song.tsx` (+ `song.test.tsx`) — `detail` in the failure toast

**Docs**
- `CLAUDE.md` — Known Gap #2 removed; new Known Gap for the re-login the new scope requires; playback key behavior
- `CONTEXT.md` — playback contract, raw-`requests.put` note removed
- `architecture.svg` — check only; the endpoint set and integrations are unchanged

**Operational**
- After deploy, the user must log out and back in once for device targeting to take effect. Until then, the error-reporting fix still applies.
