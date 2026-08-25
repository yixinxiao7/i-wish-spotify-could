## 1. Backend — exclusion in the song-listing service

- [x] 1.1 In `api/app/services/playlist_songs_service.py`, extract the cache read/populate step of `get_playlist_songs_page()` into a private `_get_or_fetch_songs(access_token, playlist_id, executor)` so a caller can obtain a playlist's full cached song list without going through pagination.
- [x] 1.2 Add `get_playlist_song_ids(access_token, playlist_id, executor=None) -> set[str]` built on `_get_or_fetch_songs`, so the destination's ID set is served from the same 5-minute per-playlist cache (design §2). Export it in `__all__`.
- [x] 1.3 Add an optional `exclude_song_ids: set[str] = None` parameter to `get_playlist_songs_page()`. Apply the exclusion to the full song list **before** `sort_songs` and before slicing, and return the post-exclusion count as `total`. Absent or empty, the code path and result must be unchanged.
- [x] 1.4 Extend `api/tests/test_service_playlist_songs.py`: exclusion removes exactly the named IDs; `total` reflects the exclusion; ordering is computed over the filtered list (an excluded song does not affect neighbors' order); excluding every song yields an empty page with `total` 0; `exclude_song_ids=None` and `set()` both leave existing results byte-identical; `get_playlist_song_ids` hits the cache on the second call (no second fetch) and drops it after `invalidate_playlist_cache`.

## 2. Backend — endpoint contract

- [x] 2.1 In `api/app/routers/playlists.py`, add `exclude_playlist_id: str | None = Query(None, ...)` to `GET /{playlist_id}/songs`.
- [x] 2.2 Reject `exclude_playlist_id == playlist_id` with `400` before any Spotify call (design §1).
- [x] 2.3 Replace `_find_owned_playlist`'s single lookup with one that resolves both the path playlist and the excluded playlist from a **single** `get_created_playlists()` result; `404` if either is unknown or unowned. Keep the existing rate-limit (`429`) and upstream-failure (`502`) mapping around that lookup, so a transient failure is never reported as a missing playlist.
- [x] 2.4 When `exclude_playlist_id` is present, resolve its song IDs via `get_playlist_song_ids` and pass them to `get_playlist_songs_page`, mapping `SpotifyRateLimitedError` → `429`, `PermissionError` → `403`, everything else → `502`, exactly as the existing read does.
- [x] 2.5 In `POST /add-song`, call `invalidate_playlist_cache(playlist_id)` for each target playlist after a successful add (design §3).
- [x] 2.6 Extend `api/tests/test_router_playlists.py`: no-parameter response unchanged; exclusion applied and reflected in `total`; `400` on self-exclusion; `404` on unknown/unowned excluded playlist; `429`/`502`/`403` mapping on the exclusion path; ownership resolved with one `get_created_playlists()` call for two playlists; `add-song` invalidates each target playlist's cache.
- [x] 2.7 Run `cd api && python3 -m pytest` — all suites green.

## 3. Frontend — shared extractions (no behavior change)

- [x] 3.1 Create `ui/src/components/ui/playlist-chooser.tsx`: heading, description, panel, loading / error+retry / empty states, and `PlaylistList` with an `onSelectPlaylist` handler, all driven by props (`title`, `description`, `emptyMessage`, `onSelectPlaylist`). Lift the markup from `ui/src/app/clean/page.tsx` verbatim.
- [x] 3.2 Rewire `ui/src/app/clean/page.tsx` onto `PlaylistChooser`. `ui/src/app/clean/page.test.tsx` must pass unmodified.
- [x] 3.3 Add `ui/src/components/ui/playlist-chooser.test.tsx`: renders rows, loading state, error state with a working retry, empty state, and that selecting a row invokes `onSelectPlaylist` with the playlist.
- [x] 3.4 Create `ui/src/hooks/use-deferred-row-action.ts` exposing `useDeferredRowAction({ windowMs, perform, buildToast })` → `{ pendingIds, trigger, undo }`. Move the timer map (`{timeoutId, resumedAt, remainingMs}`, `timeoutId: null` while paused), pause/resume, undo, the `pagehide` + unmount flush, and the failure rollback out of `ui/src/app/clean/[playlistId]/page.tsx` unchanged (design §6).
- [x] 3.5 Rewire `/clean/[playlistId]` onto the hook. `ui/src/app/clean/[playlistId]/page.test.tsx` must pass with edits only where they assert on structure, never on behavior — if a behavioral assertion has to change, the extraction is wrong.
- [x] 3.6 Add `ui/src/hooks/use-deferred-row-action.test.ts`: the window elapsing performs the action; undo before it elapses performs nothing; hover/focus pause holds the timer and leaving resumes it; a paused entry is still flushed on unmount; multiple pending rows have independent windows; a failed action rolls its row back out of `pendingIds`.

## 4. Frontend — SongCard supports the propagation row

- [x] 4.1 Add `onAdd?: (songId: string) => void` to `ui/src/components/ui/song.tsx`, rendering a plus control (lucide `Plus`) in the same slot as the existing `onRemove` trash control, with `variant="brand"`, the same 44px target treatment, and `aria-label={`Add ${name}`}`.
- [x] 4.2 Add `showAddToPlaylists?: boolean` (default `true`); when `false`, render neither the dialog nor its trigger, and skip the pin-error effect that depends on the dialog being open.
- [x] 4.3 Extend `ui/src/components/ui/song.test.tsx`: plus control appears only with `onAdd` and calls it with the song ID; it is keyboard-operable and carries the song's name in its accessible name; `showAddToPlaylists={false}` removes the add-to-playlists trigger and dialog; default props leave every existing rendering unchanged; `onAdd` and `onRemove` can coexist without layout breakage.

## 5. Frontend — the propagate destination chooser

- [x] 5.1 Add `ui/src/app/propagate/layout.tsx` with page metadata, mirroring `ui/src/app/clean/layout.tsx`.
- [x] 5.2 Add `ui/src/app/propagate/page.tsx`: `PlaylistsProvider` wrapping `PlaylistChooser` (destination copy). Selecting a destination opens the source dialog rather than navigating.
- [x] 5.3 In the same page, add the source dialog: `Dialog` + `PlaylistList` with `onSelectPlaylist`, given the owned playlists minus the chosen destination. Choosing a source pushes `/propagate/{destinationId}/from/{sourceId}`; dismissing clears the chosen destination and selects nothing.
- [x] 5.4 Handle the single-playlist case: when the user owns only the playlist they chose, the dialog states there is no other playlist to draw from instead of showing an empty list.
- [x] 5.5 Add `ui/src/app/propagate/page.test.tsx` and `layout.test.tsx`: destination list renders; choosing a destination opens the dialog; the dialog excludes the destination and includes every other owned playlist; choosing a source navigates to the right URL; dismissing selects nothing and navigates nowhere; the single-playlist message; the load-error retry path.

## 6. Frontend — the propagation song list

- [x] 6.1 Thread an optional `excludePlaylistId` through `getPlaylistSongsEndpoint` in `ui/src/utils/config.ts` (or accept it as a query param at the call site) and cover it in `ui/src/utils/config.test.ts`.
- [x] 6.2 Add `ui/src/app/propagate/[destinationId]/from/[sourceId]/layout.tsx` with page metadata.
- [x] 6.3 Add `ui/src/app/propagate/[destinationId]/from/[sourceId]/page.tsx`: fetch the source's songs with `exclude_playlist_id={destinationId}`, and render the sort control, page-size control, `SongCardSkeleton` loading state, `SongListPagination`, and `SongCard` rows exactly as `/clean/[playlistId]` does — with `onAdd` set and `showAddToPlaylists={false}`, and no `PlaylistsProvider` (design §7).
- [x] 6.4 Wire the add through `useDeferredRowAction`: 10s window, row hidden immediately, toast with progress bar and an Undo action, pause on hover/focus, `POST /api/playlists/add-song` with `{ songId, playlistIds: [destinationId] }` when the window elapses.
- [x] 6.5 Handle failures: `403` → "the playlist could not be modified", other failures → "failed to add …, please try again", both naming the song and returning it to the list; surface the server's `detail` for load failures (including `429`) with a retry.
- [x] 6.6 Handle the empty cases distinctly: `404` → the pair is unavailable; `total === 0` with a non-empty source → "nothing left to propagate"; genuinely empty source → "this playlist is empty".
- [x] 6.7 Reuse `clampOffsetPage` / `resetForLimitChange` and the step-back-a-page behavior when pending adds empty the current page.
- [x] 6.8 Add `ui/src/app/propagate/[destinationId]/from/[sourceId]/page.test.tsx` and `layout.test.tsx` covering: the request carries `exclude_playlist_id`; rows render with a plus and no add-to-playlists trigger; the deferred add fires after the window with the right body; undo cancels it; sort and page-size changes refetch from page 1; the three empty/unavailable states; the `403` and generic failure messages and rollback; pagination step-back.

## 7. Frontend — entry point

- [x] 7.1 Add the third action to `ui/src/app/page.tsx` — "propagate songs", routing to `/propagate`, with a one-line description in the existing copy voice. Keep the grid balanced at every breakpoint (three cards in a two-column grid needs a layout decision, not a third cell left dangling).
- [x] 7.2 Update `ui/src/app/page.test.tsx` for the third action and its navigation.

## 8. Verification and docs

- [x] 8.1 Run `cd ui && npm test -- --runInBand` — all suites green; confirm new frontend code meets the project's 90% coverage bar.
- [x] 8.2 Run `cd ui && npm run lint` and `npx tsc --noEmit` — clean.
- [x] 8.3 Verify in the browser end to end: pick a destination, pick a source, confirm songs already in the destination are absent, add one, undo it, add another and let it land, then confirm in Spotify. Check keyboard operation of the plus control and the undo toast, and both themes.
- [x] 8.4 Update `CLAUDE.md`: endpoint table (`exclude_playlist_id`), frontend page list, and Key Behaviors (exclusion semantics, `add-song` cache invalidation, the shared chooser/hook).
- [x] 8.5 Update `CONTEXT.md` per the project convention, and `architecture.svg` for the two new routes and the modified endpoint.
