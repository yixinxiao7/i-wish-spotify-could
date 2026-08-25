## Context

See `proposal.md` — Why. What shapes the approach:

- `GET /api/playlists/{playlist_id}/songs` already does almost everything the propagation song list needs: ownership check, whole-playlist ordering across four sort keys, listening-affinity availability, pagination, a 5-minute per-playlist in-memory cache, and typed rate-limit/permission error mapping.
- `playlists_service.get_playlist_songs()` already returns a playlist's track IDs via an ID-only `fields` projection, fetched concurrently on the shared 8-way pool. That is exactly the shape an exclusion set needs.
- `POST /api/playlists/add-song` already adds one song to a list of playlists, with permission and rate-limit handling.
- On the frontend, `/clean/[playlistId]` already contains the deferred-action machinery this feature needs verbatim: per-song timers, a toast with a depleting progress bar, pause-on-hover/focus wired to the timer (a WCAG 2.2.1 requirement, not a nicety), and a flush on `pagehide` and unmount.
- `/clean/page.tsx` already contains the playlist-chooser layout this feature needs verbatim.
- The backend runs a single worker process; all in-memory caches assume that (Known Gap #4). This change does not alter that assumption.

So the design question is almost entirely "where does reuse end and duplication begin", not "how do we fetch songs".

## Goals / Non-Goals

**Goals:**

- Add the propagation flow without introducing a second song-row component, a second playlist-chooser layout, or a second copy of the deferred-action machinery.
- Keep `GET /{playlist_id}/songs` byte-identical for existing callers.
- Keep the exclusion authoritative on the server, so pagination totals and page counts stay truthful (a client-side filter of an already-paginated page cannot do this).
- Leave `/clean/[playlistId]` behaviorally unchanged while it moves onto the shared pieces.

**Non-Goals:**

- No persistence of the destination/source pair. The pair lives in the URL; there is no server-side session state for it.
- No new caching layer. The exclusion reuses the existing per-playlist cache.
- No change to how the uncategorized-songs index is built or invalidated beyond what `add-song` already does.

## Decisions

### 1. The exclusion is a query parameter on the existing endpoint, not a new endpoint

`GET /api/playlists/{source_id}/songs?exclude_playlist_id={destination_id}` — the **path** playlist is the source (its songs are listed), and the **excluded** playlist is the destination.

*Alternative considered:* a dedicated `GET /api/playlists/{destination_id}/propagation-candidates?from={source_id}`. Rejected: it would need its own copy of sorting, affinity plumbing, pagination, ownership checks, and error mapping — four of the five things the existing endpoint already does — for one extra filter step. A new endpoint also fragments the per-playlist cache across two code paths.

*Alternative considered:* filter client-side. Rejected: the client only ever holds one page, so `total` and the page count would describe a list that includes songs the user cannot see, and paging would land on short or empty pages.

Contract details:
- Parameter absent → today's behavior exactly, including response shape.
- Parameter present and naming a playlist the user does not own (or that does not exist) → `404`, the same treatment the path playlist already gets. Both playlists are resolved in **one** pass over the single `get_created_playlists()` result, so validating two playlists costs one `/me/playlists` call, not two — this matters because `/me/playlists` is the endpoint most likely to be rate limited (CONTEXT.md §4).
- Parameter present and equal to the path playlist → `400`. Excluding a playlist from itself always yields an empty list; failing loudly beats returning "this playlist is empty" for what is a caller bug.

### 2. The exclusion set reuses the per-playlist song cache, not a fresh ID fetch per request

`playlist_songs_service` gains a way to get a playlist's song **IDs** that reads the same `_cache` entry `get_playlist_songs_page` populates, rather than calling `playlists_service.get_playlist_songs()` (the ID-only projection) separately.

*Why:* the destination playlist's ID set is needed on **every page request** of the propagation list. Going through the existing cache means it is fetched once per 5-minute window instead of once per page turn, and there is exactly one cache per playlist to reason about and invalidate — a second, differently-keyed ID cache would be a second thing to get stale.

*Trade-off:* the cached projection carries name/artists/album/art per song where only IDs are needed, so a cold destination read transfers more than the ID-only projection would. Accepted: the destination is very often a playlist the user has just been looking at, the payload is bounded by playlist size, and one cache beats one saved kilobyte.

The exclusion is applied to the source's full song list **before** sorting and pagination, so `total` is the count after exclusion, and ordering is computed over exactly the songs that will be shown.

### 3. `POST /api/playlists/add-song` invalidates each target playlist's cache

Today it invalidates nothing — nothing needed it, because the endpoint's callers never re-read a playlist's contents. Propagation does: without invalidation, a song added at 0:00 would still be missing from the destination's cached ID set until 5:00, so it would reappear as a candidate on the next page turn and could be added a second time (Spotify permits duplicates).

This is a two-line addition to the existing route and is correct for every caller, not just this feature.

### 4. Route shape: `/propagate` and `/propagate/[destinationId]/from/[sourceId]`

Both playlist IDs live in the path. Deep links work, the back button behaves, and a refresh restores the exact working state.

*Alternative considered:* `/propagate/[destinationId]?from=<sourceId>`. Rejected: it makes the source look optional when the page cannot render without it. The `/from/` segment names which ID is which, which a two-segment path (`/propagate/[a]/[b]`) would not.

Direction is fixed by the route: songs flow **from** `sourceId` **into** `destinationId`.

### 5. The source picker is a dialog over the destination chooser, not a second page

The user picks a destination, a dialog opens listing their other owned playlists, and choosing one navigates to the working page. Dismissing it leaves them where they were with nothing selected.

This reuses `Dialog` + `PlaylistList` with `onSelectPlaylist` (which already renders each row as a full-row button), filtered to drop the destination. It also gives the filter field and pinning for free in the picker.

### 6. Three extractions, each used by exactly two callers

| Extracted | From | Used by |
|---|---|---|
| `PlaylistChooser` — heading, description, panel, loading/error/empty states, `PlaylistList` | `/clean/page.tsx` | `/clean`, `/propagate` |
| `useDeferredRowAction` — per-row timers, pause/resume, undo, flush on `pagehide` + unmount | `/clean/[playlistId]/page.tsx` | `/clean/[playlistId]`, the propagation song list |
| `SongCard` props `onAdd` and `showAddToPlaylists` | — | the propagation song list |

*On `useDeferredRowAction`:* the pause/resume logic is the subtle part — the timer entry stores `{timeoutId, resumedAt, remainingMs}` and holds `timeoutId: null` while paused so the DELETE clock and the toast's dismiss clock cannot disagree. Copying that into a second page would mean two places to keep a WCAG requirement correct. The hook takes the request to perform (a function of the row), the toast copy, and the window length; both pages supply their own.

*On `SongCard`:* `onAdd?: (songId: string) => void` renders a plus control in the same slot the trash control uses (`onRemove`), and `showAddToPlaylists?: boolean` (default `true`) lets the propagation list drop the dialog. Defaults preserve every existing call site.

*Alternative considered:* a separate `PropagationSongCard`. Rejected — it would duplicate album art, playback toggle, truncation, and semantics, which is the bulk of the component, to change one button.

*Alternative considered:* leaving `/clean/[playlistId]` alone and copying its machinery. Rejected: two copies of a timer/pause implementation is exactly the drift this codebase's conventions push against, and the cleanup page's existing suites make the migration checkable.

### 7. The propagation song list does not need `PlaylistsProvider`

`SongCard` reads `PlaylistsContext` only for its add-to-playlists dialog, and already tolerates a `null` context. With `showAddToPlaylists={false}` there is nothing to feed, so the working page skips the provider and the playlist fetch it performs. `/propagate` (the chooser) still needs it.

### 8. Client-side state while an add is pending

Identical to the cleanup page's model: pending IDs are filtered out of the rendered list, `clampOffsetPage` handles paging, and a page emptied by pending adds steps back one page. The server-side exclusion and the client-side pending filter overlap harmlessly — a song is hidden by the client during its window and by the server on every fetch afterwards.

## Risks / Trade-offs

- **A cold propagation page reads two playlists instead of one** → Both reads use the shared 8-way pool and the 5-minute cache, and the destination is usually already cached from the chooser flow. The larger exposure is `/me/playlists`, which the request already needed for ownership — and both playlists are validated from that single call.
- **The 5-minute cache can hide a song added to the destination outside this app**, letting the user add a duplicate → Bounded to the cache window, and self-inflicted duplicates are prevented by decision 3. Not worth a per-request freshness check that would undo the caching.
- **Migrating `/clean/[playlistId]` onto the shared hook could regress the undo window** → The page's existing suites cover the timer, the pause behavior, the flush, and the failure path; they must pass unmodified except where the change is purely structural. If the hook cannot satisfy them without altering assertions about behavior, the extraction is wrong, not the tests.
- **`exclude_playlist_id` widens a public endpoint's contract** → Additive and optional; absent it, the code path is unchanged. Covered by a test that asserts the no-parameter response is unchanged.
- **Two IDs in the URL invite hand-edited or stale links** (a deleted playlist, or a pair the user no longer owns) → Both resolve to the same `404`-backed "this pair is unavailable" state the cleanup page already models for one playlist.
- **Rate limiting mid-session is the most likely live failure**, given Development Mode quota → Every new path maps `SpotifyRateLimitedError` to `429` with the existing message, and the frontend surfaces the server's own detail rather than a generic retry prompt.

## Migration Plan

Purely additive; nothing to migrate.

- No new environment variables, no new runtime state files, no OAuth scope changes (`playlist-read-private` and `playlist-modify-public`/`-private` are already requested, so existing sessions work without re-login).
- Deploy order does not matter for correctness, but shipping the backend first means the frontend never calls an endpoint that ignores `exclude_playlist_id` and shows already-present songs.
- Rollback is a revert: removing the routes and the query parameter leaves every existing behavior intact, since the shared extractions preserve `/clean`'s behavior exactly.
