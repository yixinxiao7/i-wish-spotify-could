## Why

Playlists that sit next to each other in genre — boom bap and jazz rap, house and disco — share a lot of the same songs, but the only way to build one from the other today is to remember which tracks overlap and re-file them one at a time through the "add to playlists" dialog on `/organize`. That dialog only ever sees liked songs that are in *no* playlist, so a song already living in the boom bap playlist is invisible to it. There is no path in the app from "this playlist is a good source of material" to "add these of its songs to that other playlist."

This change adds that path: pick a destination playlist, pick a source playlist to draw from, and work through the source's songs adding the ones that fit.

## What Changes

**New user flow — propagate songs**

- A third action on the landing page, **propagate songs**, alongside "categorize songs" and "clean up playlists".
- `/propagate` — a playlist chooser that lists the user's owned playlists, structured exactly like `/clean`: the same `PlaylistList` (pinning, filter, full-row targets), the same panel/heading/error/empty treatment. Choosing a playlist here picks the **destination** — the playlist songs will be added *to*.
- Choosing a destination opens a dialog listing the user's other owned playlists, so the user picks the **source** — the playlist songs are drawn *from*. The destination itself is excluded from that list; a user cannot propagate a playlist into itself.
- `/propagate/[destinationId]/from/[sourceId]` — the working page. It lists the source playlist's songs using the same `SongCard`, sort control, page-size control, and `SongListPagination` as `/clean/[playlistId]`, with two differences:
  - each row's action is a **plus** that adds that song to the destination playlist, in place of the cleanup page's trash control;
  - the card's **"add to playlists" dialog is not rendered** — the destination is already chosen, so a second, contradictory destination picker on every row would be noise.
- Songs the destination playlist **already contains are filtered out**, so every row on the page is a song the user can actually act on and no action can silently create a duplicate. A source whose songs are all already in the destination shows a "nothing left to propagate" empty state, distinct from "this playlist is empty."
- Adding is **deferred and reversible**, matching removal on `/clean/[playlistId]` exactly: the row disappears immediately, a toast with a depleting progress bar offers Undo for 10 seconds, the timer pauses on hover/focus, and the request fires only when the window elapses. A pending add is flushed on unmount and on `pagehide` rather than dropped.
- Sorting reuses the existing four keys (playlist order, oldest added, newest added, least listened first) and the existing availability messaging for listening affinity. No new sort key.

**Backend**

- `GET /api/playlists/{playlist_id}/songs` gains an optional `exclude_playlist_id` query parameter. When present, the endpoint reads that playlist's track IDs and omits any song already in it, computing the exclusion — and therefore `total` — over the whole ordered list before paginating, so pagination stays truthful. Absent, behavior is byte-identical to today.
- The destination playlist's identity is validated the same way the path playlist is: both must be owned by the current user, or the request is a `404`.
- No new endpoint is needed for the add itself — `POST /api/playlists/add-song` already adds one song to a list of playlists. Its existing side effect of dropping the song from the uncategorized index stays correct here (a song being propagated is by definition already in a playlist, so it is not in the index and the removal is a no-op).
- `POST /api/playlists/add-song` also invalidates each target playlist's cached song list, so a song just added stops being offered as a candidate immediately instead of after the cache's freshness window — without which the same song could be added twice.

**Component reuse**

- `SongCard` gains an `onAdd` prop (renders a plus control) and a `showAddToPlaylists` flag (default `true`, set `false` by the propagate page). No new song-row component.
- The playlist chooser body of `/clean` is extracted into a shared component both `/clean` and `/propagate` render, so the two choosers cannot drift apart.
- The deferred-action machinery on `/clean/[playlistId]` — per-row timers, pause on hover/focus, undo, flush on unmount and `pagehide` — is extracted into a shared hook both pages use, so the WCAG 2.2.1 pause behavior has exactly one implementation. `/clean/[playlistId]` moves onto it with no behavior change; its existing suites are the guard.

**Non-goals**

- No bulk/multi-select add. One song, one click, consistent with how filing works everywhere else in the app.
- No "propagate in reverse" or two-way sync. The flow is one-directional per session; the user re-enters it with the playlists swapped if they want the other direction.
- No cross-user or followed-playlist support. Both playlists must be owned by the current user, same as every other write path in the app.

## Capabilities

### New Capabilities

- `song-propagation`: Copying songs from one owned playlist into another — choosing a destination and a source, presenting only the source songs the destination is missing, and adding a chosen song to the destination reversibly.

### Modified Capabilities

None. `playlist-pinning` already requires that a newly added playlist view inherit pin toggles and pinned-first ordering from the shared playlist list, which is exactly what `/propagate` does — no requirement of it changes. `spotify-auth` is untouched: the flow needs `playlist-read-private` and `playlist-modify-*`, all already in the requested scope set. The requirements governing the shared song-list behavior this feature reuses (`ui-list-navigation`, `ui-feedback`, `ui-design-system`) still live in the unarchived `resolve-ui-audit-findings` change; this change adds no requirements to them, it inherits them by reusing the components they govern.

## Impact

**Backend**
- `api/app/routers/playlists.py` — `exclude_playlist_id` query param on `GET /{playlist_id}/songs`, ownership validation of the excluded playlist, and cache invalidation on `POST /add-song`
- `api/app/services/playlist_songs_service.py` — a cached way to read a playlist's song IDs, and exclusion applied to the source's full list before sorting and pagination
- `api/app/services/playlists_service.py` — no change; `get_playlist_songs()` already returns the ID-only projection the exclusion needs
- `api/tests/test_router_playlists.py`, `api/tests/test_service_playlist_songs.py` — exclusion coverage, including the ownership `404` and the "everything already present" case

**Frontend**
- `ui/src/app/page.tsx` — third landing action
- `ui/src/app/propagate/page.tsx` + `layout.tsx` — destination chooser and source-picker dialog
- `ui/src/app/propagate/[destinationId]/from/[sourceId]/page.tsx` + `layout.tsx` — the working song list
- `ui/src/components/ui/song.tsx` — `onAdd` and `showAddToPlaylists` props
- `ui/src/components/ui/playlist-chooser.tsx` (new) — the chooser body shared by `/clean` and `/propagate`
- `ui/src/hooks/use-deferred-row-action.ts` (new) — the deferred/undoable row action shared by both song lists
- `ui/src/app/clean/page.tsx` and `ui/src/app/clean/[playlistId]/page.tsx` — rewired onto the shared chooser and hook, behavior unchanged
- `ui/src/utils/config.ts` — `exclude_playlist_id` threaded through `getPlaylistSongsEndpoint`
- New/updated Jest suites for every file above

**Docs**
- `CLAUDE.md` — endpoint table, page list, key behaviors
- `CONTEXT.md` — per the project convention that it tracks behavior and contract changes
- `architecture.svg` — two new routes and the modified endpoint
