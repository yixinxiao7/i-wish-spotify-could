## 1. Backend — HTTP client

- [x] 1.1 Add `spotify_put(url, **kwargs)` to `api/app/services/http_client.py`, mirroring `spotify_post` (same retry decorator, routed through `_call`). Export it in `__all__`.
- [x] 1.2 Extend `api/tests/test_service_http_client.py`: `spotify_put` success passthrough, 429-with-retry, and 429 beyond `MAX_RETRY_AFTER_SECONDS` → `SpotifyRateLimitedError`.

## 2. Backend — playback service

- [x] 2.1 In `api/app/services/playback_services.py`, add `PlaybackError(Exception)` with `status`, `reason`, `message`, built from Spotify's error body; tolerate a non-JSON or empty body.
- [x] 2.2 Add `_resolve_device_id(access_token) -> str` (design §1): active + unrestricted, else first unrestricted, else raise `PlaybackError(reason="NO_DEVICE")`.
- [x] 2.3 Rewrite `toggle_playback()`: on `play`, resolve the device when `user-read-playback-state` is in `get_granted_scopes()` and pass `params={"device_id": ...}`; otherwise send today's untargeted request (design §2). On `pause`, send no body and no device lookup. Use `spotify_put`/`spotify_get`. Treat any 2xx as success; raise `PlaybackError` otherwise.
- [x] 2.4 Rewrite `api/tests/test_service_playback.py`: device selection order (active wins; restricted skipped; first-unrestricted fallback; empty list → `NO_DEVICE`); `device_id` sent on play when scope granted; no devices call and no `device_id` when scope missing; pause sends no device lookup; `202` and `204` both succeed; `404 NO_ACTIVE_DEVICE`, `403 PREMIUM_REQUIRED`, generic `403`, `500`, and non-JSON error bodies each raise `PlaybackError` with the right fields; `SpotifyRateLimitedError` propagates untouched.

## 3. Backend — playback router

- [x] 3.1 In `api/app/routers/playback.py`, move `get_valid_token()` inside the error handling and map its failure (including `FileNotFoundError`) to `401`.
- [x] 3.2 Map `SpotifyRateLimitedError` → `429` (`RATE_LIMIT_DETAIL`), and `PlaybackError` per design §3: no device → `409`, Premium → `403`, other `403` on play → `403`, `403` on pause → `200` success body, everything else → `502`. Never return a tuple.
- [x] 3.3 Rewrite `api/tests/test_router_playback.py`: success bodies unchanged; each row of the design §3 table asserts status **and** `detail`; token failure → `401`; an unexpected exception → `502`, not `500`; replace both existing `*_error_branch` tests, which assert the buggy `200`.
- [x] 3.4 Run `cd api && python3 -m pytest` — all suites green; coverage of `playback.py` and `playback_services.py` ≥ 90%.

## 4. Frontend

- [x] 4.1 Add `'user-read-playback-state'` to `SCOPES` in `ui/src/utils/config.ts`; update `ui/src/utils/config.test.ts` if it pins the scope list.
- [x] 4.2 In `ui/src/components/ui/song.tsx` `handlePlaybackToggle`, on a non-ok response read `detail` from the JSON body when it is a string and toast it; fall back to the existing generic copy when the body is missing, non-JSON, or has no string `detail`. The icon must stay unchanged on failure.
- [x] 4.3 Extend `ui/src/components/ui/song.test.tsx`: `409` with `detail` → that text is toasted and the icon stays "Play"; non-ok with non-JSON body → generic copy; stop failure with `detail` → that text, icon stays "Pause". Existing playback tests must still pass (their mocks lack `json`, which exercises the fallback).
- [x] 4.4 Run `cd ui && npm test -- --runInBand` — all suites green.

## 5. Docs

- [x] 5.1 `CLAUDE.md`: remove Known Gap #2; add a Known Gap that `user-read-playback-state` needs one re-login, with the degraded behavior until then; add a playback key behavior (device resolution, error contract, `spotify_put`); update the "playback uses raw `requests.put`" note and the test counts.
- [x] 5.2 `CONTEXT.md`: update the playback contract and remove the raw-`requests.put` and "returns HTTP 200 on failure" notes.
- [x] 5.3 `architecture.svg`: confirm no change is needed (endpoint set and integrations unchanged); edit only if the playback label no longer matches.

## 6. Verify live

- [ ] 6.1 Deploy, then log out and back in on the live site so the token carries `user-read-playback-state`.
- [ ] 6.2 With the Spotify desktop app open but idle: play a song from `/organize` → it plays on that device.
- [ ] 6.3 With a different track already playing: play → the requested track replaces it.
- [ ] 6.4 Pause → playback stops; pause again → no error toast.
- [ ] 6.5 Quit every Spotify client: play → toast reads "Open Spotify on a device, then try again." and the icon stays "Play".
- [ ] 6.6 If 6.2 or 6.3 still plays nothing, fall back to design §1's "transfer playback first" alternative before shipping.
