# Code Audit Report — `i-wish-spotify-could`

**Date:** 2026-02-17
**Auditor:** Claude Code (claude-sonnet-4-6)
**Branch:** feature/ui-enhancement

---

## Good News First

- `.env`, `token.json`, `user_id.json`, and `all_uncategorized_songs.json` are **not tracked in git** (correctly excluded via `.gitignore`).
- Dependencies are modern and up to date (FastAPI 0.115, Next.js 15, React 19).
- Pydantic models exist for request bodies.
- Docstrings are consistently written on all service functions.

---

## Security Vulnerabilities

### ✅ 1. OAuth CSRF — Missing State Verification `[HIGH]` — FIXED

`ui/src/app/login/page.tsx` now stores the generated `state` in `sessionStorage['oauth_state']` before redirecting. `callback/page.tsx` passes the returned `state` param to `ClientComponent`, which verifies it against `sessionStorage['oauth_state']` and redirects to `/login` on mismatch. The stored state is removed after a successful check.

---

### ✅ 2. Error Details Leaked to Client `[MEDIUM]` — FIXED

`api/app/routers/oauth.py`: Spotify error is now logged server-side via `logger.error(...)` and a generic `502` with `"Failed to exchange authorization code"` is returned to the client.

---

### ✅ 3. HTTP 200 Returned on Errors `[MEDIUM]` — FIXED

`api/app/routers/playlists.py`: The bare `except` now logs the error server-side and raises `HTTPException(status_code=500, detail="Failed to add song to playlists")` instead of returning a silent 200.

---

### ✅ 4. No Server-Side Token Expiry Check `[MEDIUM]` — FIXED

Created `api/app/services/token_service.py` with `get_valid_token()`. It reads `token.json`, checks `expires_at` (with a 60-second buffer), and transparently refreshes via the Spotify refresh token endpoint when needed. `oauth.py` now writes `expires_at = now + expires_in` into `token.json` on initial exchange. All routers (`songs.py`, `playlists.py`, `playback.py`) now call `get_valid_token()` instead of reading the token directly.

---

### ✅ 5. Client-Side Auth Gate Is Bypassable `[LOW]` — FIXED

`ui/src/app/layout.tsx`: The auth check now reads `token_expiry` and compares it against the current Unix timestamp (`parseInt(expiry) < now`), so an expired token correctly triggers a redirect to `/login`.

---

### ✅ 6. CORS — Overly Permissive Headers and Methods `[LOW]` — FIXED

`api/app/main.py`: Restricted to `allow_methods=["GET", "POST", "PUT"]` and `allow_headers=["Content-Type"]`.

---

## Testing Coverage

### ✅ Backend — FULLY COVERED

`pytest` and `pytest-cov` added to `requirements.txt`. `pytest.ini` configured with `pythonpath = .`, `testpaths = tests`, and `--cov=app --cov-report=term-missing`. A `conftest.py` fixture uses `monkeypatch.chdir(tmp_path)` to isolate file-system state between tests.

| Test file | What it covers |
|---|---|
| `test_main.py` | Root endpoint, OpenAPI schema paths |
| `test_models.py` | All Pydantic schema models construct correctly |
| `test_router_oauth.py` | Token written with `expires_at`; 502 on Spotify failure; 422 on missing body |
| `test_router_songs.py` | Total count endpoint; paginated songs; 422 on invalid `offset`/`limit` |
| `test_router_playlists.py` | Get playlists; add-song updates cache; add-song without cache file; 500 on service error; 422 on missing fields |
| `test_router_playback.py` | Start/stop success with correct action forwarded; error branch response |
| `test_service_token.py` | Valid token returned without refresh; refresh with token rotation; refresh without new refresh token; refresh failure raises |
| `test_service_users.py` | Success; 500 error raises |
| `test_service_songs.py` | Total liked songs; pagination + artist join + missing image; liked songs error; reads cache; builds + writes cache; total from cache length; busy-wait timeout raises |
| `test_service_playlists.py` | Pagination + user caching; uses existing user cache; error raises; playlist songs pagination; add song success (parallel); add song failure raises |
| `test_service_playback.py` | Toggle play success; toggle pause error raises |

All previously-identified high-risk paths are now tested:
- ✅ `get_uncategorized_songs` / `get_total_uncategorized_songs` (cache hit, cache miss, timeout)
- ✅ `add_song_to_playlists` (concurrent futures success and failure)
- ✅ OAuth exchange (`set_token`) success and failure
- ✅ Pagination bounds validated and tested

### ⏳ Frontend — INFRASTRUCTURE ONLY, NO TEST FILES

Jest is configured (`jest.config.js`) with `next/jest` integration, `jest-environment-jsdom`, 85% coverage thresholds on branches/functions/lines/statements, and path aliasing for `@/`. `jest.setup.ts` and a style mock exist. **No `.test.ts` / `.test.tsx` files have been written.** Frontend components and pages remain untested.

**Remaining frontend coverage gaps:**

| Component | Risk Without Tests |
|---|---|
| `ClientComponent.tsx` | OAuth state verification, sessionStorage writes, redirect logic |
| `organize/page.tsx` | Parallel data fetch, pagination logic, per-page limit changes |
| `SongCard` (`song.tsx`) | Play/pause toggle, playlist dialog, add-song confirmation |
| `layout.tsx` | Token expiry check, unauthenticated redirect |
| `login/page.tsx` | State generation and sessionStorage write before redirect |

---

## Software Engineering Issues

### ✅ 7. Wildcard Imports `[MEDIUM]` — FIXED

All wildcard imports replaced with explicit imports:
- `routers/songs.py`: `from app.services.songs_service import get_uncategorized_songs, get_total_uncategorized_songs`
- `routers/playlists.py`: `from app.services.playlists_service import get_created_playlists, add_song_to_playlists`
- `services/songs_service.py`: `from app.services.playlists_service import get_created_playlists, get_playlist_songs`
- `services/playlists_service.py`: `from app.services.users_services import get_current_user_id`

---

### ✅ 8. Unbounded Pagination Parameters `[MEDIUM]` — FIXED

`api/app/routers/songs.py`: Query params now use `Query(0, ge=0)` for offset and `Query(10, ge=1, le=100)` for limit. FastAPI returns a 422 automatically on violation.

---

### ✅ 9. Busy-Wait Loop `[MEDIUM]` — FIXED

`api/app/services/songs_service.py`: The `while not os.path.exists(...)` loop now increments an `elapsed` counter and raises `Exception("Timed out waiting for uncategorized songs cache to be created")` after 30 seconds instead of spinning indefinitely.

---

### 10. Single-User / Single-File Token Architecture `[MEDIUM]` — DEFERRED

`token.json` and `user_id.json` are single files on disk shared by all requests. If two users ever used this simultaneously, or if the server is restarted mid-request, they would clobber each other. The `TODO: change to token manager like redis` comment at `api/app/routers/oauth.py` acknowledges this. Deferred — this app is intentionally single-user for now.

---

### ✅ 11. `CallBackClient` is Not a Valid React Component `[LOW]` — FIXED

`ui/src/app/callback/ClientComponent.tsx`: Component now correctly destructures props as `({ token_expires_in, state }: { token_expires_in: number | undefined, state: string | undefined })`. The `if (expires_in)` truthy-object bug is gone; the check is now against the properly typed `token_expires_in` value.

---

### 12. `layout.tsx` as a Client Component `[LOW]` — DEFERRED

Moving auth gating to Next.js middleware would require switching from `sessionStorage` to cookies, which is a broader architectural change. Deferred.

---

### ✅ 13. Inline Event Handlers Instead of CSS Hover `[LOW]` — FIXED

`ui/src/app/layout.tsx`: `onMouseOver`/`onMouseOut` DOM mutation removed. The `<Link>` now uses Tailwind classes: `hover:underline hover:text-[#1DB954] transition-colors duration-200`.

---

### ✅ 14. ThreadPoolExecutor Without `max_workers` `[LOW]` — FIXED

`api/app/services/playlists_service.py`: `ThreadPoolExecutor(max_workers=10)` now caps the thread pool regardless of how many playlists are submitted.

---

## Summary Table

| # | Issue | Severity | Category | Status |
|---|---|---|---|---|
| 1 | OAuth state not verified (CSRF) | HIGH | Security | ✅ Fixed |
| 2 | Spotify error details leaked to client | MEDIUM | Security | ✅ Fixed |
| 3 | HTTP 200 returned on exception | MEDIUM | Security / Reliability | ✅ Fixed |
| 4 | No server-side token expiry check | MEDIUM | Security | ✅ Fixed |
| 5 | Client-side auth bypassable | LOW | Security | ✅ Fixed |
| 6 | CORS methods/headers too permissive | LOW | Security | ✅ Fixed |
| — | **Test coverage** | HIGH | Testing | ✅ Backend done / ⏳ Frontend pending |
| 7 | Wildcard imports | MEDIUM | Engineering | ✅ Fixed |
| 8 | Unbounded pagination params | MEDIUM | Engineering | ✅ Fixed |
| 9 | Busy-wait loop in service layer | MEDIUM | Engineering | ✅ Fixed |
| 10 | Single-file token store (not multi-user) | MEDIUM | Architecture | ⏳ Deferred |
| 11 | `CallBackClient` props bug | LOW | Correctness | ✅ Fixed |
| 12 | Root layout is a client component | LOW | Engineering | ⏳ Deferred |
| 13 | Inline hover via DOM mutation | LOW | Engineering | ✅ Fixed |
| 14 | Unbounded thread pool | LOW | Engineering | ✅ Fixed |

---

## Recommended Priority Order

1. ✅ **Fix the OAuth CSRF** (#1) — correctness bug, not just hardening
2. ✅ **Fix `CallBackClient` props** (#11) — actual logic bug where auth state may never properly set
3. ✅ **Add token expiry checks + refresh** (#4)
4. ✅ **Backend test coverage** — all services and routers covered with pytest
4b. ⏳ **Frontend test coverage** — Jest configured with 85% thresholds but no test files written yet
5. ✅ **Fix error handling** (#2, #3) — proper HTTP status codes and no raw exception strings to clients
6. ✅ **Add pagination validation** (#8)
7. ✅ Everything else (#5, #6, #7, #9, #13, #14)
