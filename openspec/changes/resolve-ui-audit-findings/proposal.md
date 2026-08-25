## Why

A frontend audit of the app found 28 defects: one that makes pagination unreachable on phones, seven WCAG AA failures or Level-A concerns, and a visual language that reads as machine-generated — a green-to-blue gradient on every action and a decorative glass treatment applied identically to five unrelated kinds of surface. Text contrast was clearly checked at some point and passes comfortably in both themes; nothing that isn't text was ever checked, so not one interactive control in the app has a boundary that meets the 3:1 minimum.

The gradient is also simply not wanted. Removing it forces the question the audit raised anyway — the app has decoration where it should have hierarchy — so the accent, the surfaces, and the contrast floors get settled together rather than patched one finding at a time.

## What Changes

**Visual language**

- **BREAKING (visual)** Remove the green-to-blue gradient entirely. The `brand` button becomes a flat Spotify-green fill with near-black text and a darker green border that carries the boundary; `brandMuted` becomes a transparent outlined style. No gradient remains in any button, control, or accent.
- **BREAKING (visual)** Retire `.glass-surface`. Cards become flat, opaque, tokenized surfaces. `backdrop-filter` is removed from list rows, where up to 50 blur regions per page composite over a smooth gradient that shows no blur at all.
- Retint the inherited shadcn neutrals (`--muted-foreground`, `--border`, `--input`, `--ring`, `--brand-footer`) from warm stone onto the app's cool teal ramp, at lightness values that clear 3:1 for boundaries and 4.5:1 for text against both the card and the page background, in both themes.
- Give destructive actions a destructive treatment instead of reusing the neutral secondary style.
- Settle the button-shape conflict where `size="sm"` silently overrides the `brand` variant's pill radius, so the app's primary action stops being the only brand button shaped differently from the rest.

**Reachability and correctness**

- Adapt pagination below the `sm` breakpoint so a phone gets Previous / position / Next instead of a 428px numbered strip that forces horizontal scrolling of the whole page.
- Fix the ellipsis that claims skipped pages where none are skipped, and the page-size change that keeps a stale offset and page number.
- Make the loading skeleton match the card it stands in for; it is currently 1024px wide against a 499px card.
- Load album art for rows that are already on screen instead of deferring every image.

**What the app communicates**

- Scope the cleanup page's live region to what actually changed, instead of re-announcing up to fifty songs on every sort, page and removal.
- Separate error announcements from status announcements, and stop each new toast re-reading the ones before it.
- Free `DialogDescription` from duty as a scroll container, so opening "add to playlists" stops reading the entire playlist list as the dialog's description.
- Give the song list real list and heading semantics.
- Let a reversible action stay reversible: pause the undo window on hover and focus and lengthen it, so five seconds is no longer the entire budget for finding and pressing Undo.
- Show the reason the server actually gave for listening-affinity being unavailable, instead of always telling the user to log out and back in.
- Give the playlist rows on `/clean` a full-row target and a hover state, and add a filter to the playlist dialog so filing a song stops requiring a scan of the whole library.
- Replace the unstyled `Redirecting...` fragment with the themed auth shell.

**Hygiene**

- Clear the four ESLint errors and two warnings, fix the `React.memo` defeated by an inline prop, drop the unused `cross-fetch` dependency and the stray Jest `transform` key, move the toast progress bar off animating `width`, and prune the resolved entry from `CLAUDE.md`'s Known Gaps.

**Explicitly out of scope**: the centered-column layout template, the single-typeface (IBM Plex Mono) treatment, and the uniform card grid. Those are the remaining anti-pattern tells and they need a layout and typography direction, not a token pass.

## Capabilities

### New Capabilities

- `ui-design-system`: The single visual language every surface, control and accent draws from — accent treatment, surface treatment, contrast floors for text and for component boundaries, target sizes, focus indication, and parity between light and dark themes.
- `ui-list-navigation`: How the two paginated song lists behave as the user moves through them — paging controls that fit the viewport, truthful position indicators, page-size semantics, and loading placeholders that match the content they stand in for.
- `ui-feedback`: What the app communicates and how — announcement scoping and roles, dialog and list semantics, the window in which a reversible action stays reversible, and status messages that reflect the actual cause.

### Modified Capabilities

None. The findings concern presentation and client behavior; no existing backend capability's requirements change. `playlist-cleanup` and `listening-affinity` are still deltas inside the unarchived `add-playlist-cleanup` change, so the requirements this change adds for their UI live in the new capabilities above rather than as edits to specs that have not landed.

## Impact

**Frontend — visual language**
- `ui/tailwind.config.ts` — brand color scale
- `ui/src/app/globals.css` — token definitions for both themes, `.glass-surface`, `.auth-bg`, `.app-bg`, toast variants
- `ui/src/components/ui/button.tsx` — `brand` / `brandMuted` variants, `sm` size radius, a new destructive variant
- `ui/src/components/ui/card.tsx`, `select.tsx`, `checkbox.tsx`, `dialog.tsx` — surface and border tokens

**Frontend — behavior**
- `ui/src/components/ui/pagination.tsx` — responsive collapse
- `ui/src/app/organize/page.tsx`, `ui/src/app/clean/[playlistId]/page.tsx` — pagination logic, page-size handling, live-region scoping, undo timing, affinity messaging; the duplicated `SongCardSkeleton` and pagination blocks are extracted so each fix lands once
- `ui/src/components/ui/song.tsx` — image loading, play-control hierarchy, list/heading semantics, redundant album line
- `ui/src/components/ui/playlist-list.tsx` — row targets, hover state, dialog filter
- `ui/src/components/toast-provider.tsx` — status/alert split, timer pausing, progress bar transform
- `ui/src/components/app-shell.tsx` — themed redirect state

**Tests** — 28 existing suites will need updating where they assert on gradient classes, glass classes, or pagination markup. New coverage for the contrast floors, the responsive pagination collapse, and the undo pause behavior.

**Docs** — `CLAUDE.md` design context (aesthetic direction currently names glassmorphism and gradients as the approach to preserve), Known Gaps #4, and `architecture.svg` if any route or component boundary moves.

**No backend impact.** No API contract, service, or runtime-state file changes.
