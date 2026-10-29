## Context

See `proposal.md` — Why. What shapes the approach:

- The app is a remote control: `PUT /api/playback/start` asks Spotify to play a track on whatever device the user has Spotify open on. There is no audio in the browser.
- Spotify's `/me/player/play` without `device_id` routes to the device it currently considers active. The live investigation showed that routing can accept the command (`204`) and still play nothing; with `device_id` it played at once.
- Every other router already maps Spotify failures to typed HTTP statuses (`429` rate limit, `403` permission, `502` upstream). Playback is the one router that predates that convention.
- `affinity_service` already establishes how to add a scope after users have tokens: check `get_granted_scopes()` before spending a request, and degrade rather than break (Known Gap #5).

## Goals / Non-Goals

**Goals:**

- A failed play/pause is never reported as success, and the user sees a sentence that says what to do.
- A play request that Spotify accepts actually plays, on a device the user has open.
- No session breaks on deploy: tokens without the new scope keep today's behavior.

**Non-Goals:** see `proposal.md`.

## Decisions

### 1. Resolve the device on every play, server-side

`toggle_playback(token, "play", song_id)` calls `GET /v1/me/player/devices` and picks:

1. the device with `is_active: true` and `is_restricted: false`, else
2. the first device with `is_restricted: false`, else
3. none → `PlaybackError(reason="NO_DEVICE")`.

It then calls `PUT /v1/me/player/play?device_id={id}`.

*Alternative considered:* cache the chosen device. Rejected — devices come and go (the user closes the desktop app, opens their phone), and a stale cached ID reproduces the exact silent-drop bug this change fixes. One extra cheap GET per play click is fine for a click-driven action.

*Alternative considered:* `PUT /v1/me/player` (transfer playback) first, then play. Rejected for now — passing `device_id` to `play` already wakes the target device, as verified live. Revisit only if targeting alone proves insufficient.

`pause` does **not** resolve a device. It acts on whatever is playing, which is the device play just targeted, and skipping the lookup keeps pause one request.

### 2. Missing scope degrades to today's untargeted request

`/me/player/devices` requires `user-read-playback-state`, which no existing token has. If `"user-read-playback-state" not in get_granted_scopes()`, `play` skips resolution and sends the untargeted request exactly as today. Error reporting (§3) still applies, so the user at least sees Spotify's real failure.

*Why not force re-login:* the app's convention (Known Gap #5) is that a scope addition never breaks an existing session.

### 3. Error contract

The service raises `PlaybackError(status, reason, message)` built from Spotify's `{"error": {"status", "message", "reason"}}` body (tolerating a non-JSON body). The router maps:

| Cause | HTTP | `detail` |
|---|---|---|
| `SpotifyRateLimitedError` | 429 | the shared `RATE_LIMIT_DETAIL` |
| token refresh fails / no token | 401 | "Your Spotify session expired. Log in again." |
| `NO_DEVICE` (our own) or Spotify `404 NO_ACTIVE_DEVICE` | 409 | "Open Spotify on a device, then try again." |
| Spotify `403 PREMIUM_REQUIRED` | 403 | "Playback control requires Spotify Premium." |
| other Spotify `403` on `play` | 403 | "Spotify refused to play this song on your device." |
| Spotify `403` on `pause` | 200 | — treated as success: the restriction means the player is already paused, which is the requested end state |
| anything else | 502 | "Couldn't reach Spotify playback. Try again." |

`409` for no device (rather than `404`) because the resource — the song — exists; the user's player is in a state that conflicts with the request.

Success bodies stay `{"message": "Playback started successfully"}` / `"...stopped..."` so the frontend's success path is untouched.

### 4. `spotify_put` in `http_client`

Added alongside `spotify_post`/`spotify_delete` with the same tenacity wrapper and `_call` normalization. This retires the raw `requests.put` that CONTEXT.md flags, and gives playback 429 handling for free.

### 5. Frontend reads `detail`

In `handlePlaybackToggle`, on `!response.ok` try `await response.json()` and use `detail` when it is a string; otherwise keep "Failed to start playback." / "Failed to stop playback." Parsing failures fall back to the generic copy — never a second error toast.

## Risks / Trade-offs

- **Untested assumption about root cause.** The silent `204` is attributed to missing `device_id` on the strength of one live A/B (targeted plays, untargeted doesn't). If targeting alone does not fix it, §1's rejected "transfer first" alternative is the next step; the error-reporting half of this change is independently valuable either way.
- **Extra request per play.** One `GET /me/player/devices` per play click. Acceptable for a user-paced action; it shares the 429 handling.
- **Re-login required for the fix's main half.** Mitigated by §2 and documented as a Known Gap, same as `user-top-read`.
