Each task cites the audit finding it closes (C1, H1–H7, M1–M12, L1–L8). Stages follow the sequencing in `design.md` — Migration Plan; each stage is independently shippable.

## 1. Reflow fix — ships first, unblocks a core flow

- [x] 1.1 Add a responsive collapse to `ui/src/components/ui/pagination.tsx`: below the `sm` breakpoint render Previous / position readout / Next only, and suppress the numbered links and ellipses (**C1**, per design D4)
- [x] 1.2 Add the position readout ("Page 3 of 49") as a non-interactive element in the collapsed form, so position stays legible when the numbers are dropped (**C1**)
- [x] 1.3 Verify Previous and Next keep a 44×44 target in the collapsed form and are not shrunk to fit (**C1**)
- [x] 1.4 Add a test asserting `document.scrollWidth <= clientWidth` at 320px and 375px on a middle page of a long list, and that both page-advance controls are within the viewport
- [x] 1.5 Confirm the full numbered control set still renders at `sm` and above

## 2. Extract the shared list machinery — no behavior change

- [x] 2.1 Extract `SongCardSkeleton` from `organize/page.tsx` and `clean/[playlistId]/page.tsx` into one shared component that accepts the same `className` as `SongCard` (**H4**, per design D5)
- [x] 2.2 Pass the callers' width classes (`w-full md:w-3/5 lg:w-2/5`) into the skeleton at both call sites, so the placeholder matches the 499px card instead of stretching to 1024px (**H4**)
- [x] 2.3 Add a test asserting the skeleton and the loaded `SongCard` resolve to the same width and height classes
- [x] 2.4 Extract the duplicated ~65-line pagination block and `handleOffsetChange` from both pages into one shared component
- [x] 2.5 Have the extracted component adopt `clean/[playlistId]`'s correct page-size reset, so `/organize` inherits the fix rather than keeping its own broken copy (**M3**, per design D5)
- [x] 2.6 Confirm the existing test suites still pass with no behavioral change from the extraction

## 3. List-navigation correctness

- [x] 3.1 Gate the leading skipped-pages marker on `currentPage > 3` and the trailing one on `currentPage < lastPage - 2`, so no marker claims a gap where pages are consecutive (**M2**)
- [x] 3.2 Add a test asserting no skipped-pages marker appears between the "1" control and the "2" control when the user is on page 3
- [x] 3.3 Reset offset and current page when the page size changes, and add a test that the items shown, the reported current page, and the reported total pages agree afterwards (**M3**)
- [x] 3.4 Add a test that advancing a page after a page-size change shows the items following the previous page
- [x] 3.5 Set `priority` on album art for rows within the viewport on first render, keeping deferred loading for rows below the fold (**M5**)

## 4. Feedback, semantics and reversibility

- [x] 4.1 Remove `aria-live="polite"` from the song-list container in `clean/[playlistId]/page.tsx` — removals are already announced by the toast region and loading has its own `role="status"` (**H6**, per design D6)
- [x] 4.2 Add a test asserting that changing sort or page does not re-announce individual song entries
- [x] 4.3 Split the toast host in `toast-provider.tsx` into two sibling regions: `role="status"` for success and `role="alert"` for errors (**M10**, per design D6)
- [x] 4.4 Move `aria-atomic="true"` from the toast container down onto the individual toast, so a new toast stops re-reading the ones before it (**M10**)
- [x] 4.5 Add a test asserting an error message lands in the assertive region and a success message in the polite one
- [x] 4.6 Replace `DialogDescription`-as-scroll-container in `ui/src/components/ui/song.tsx` with a plain element, and either supply a real one-line description or set `aria-describedby={undefined}` so the playlist list stops being read as the dialog's description (**M4**)
- [x] 4.7 Add a test asserting the dialog's accessible description is not the playlist list
- [x] 4.8 Render the song list as `ul`/`li` and promote each song title to a heading one level below the page `h1`, styled identically (**M7**)
- [x] 4.9 Add a test asserting the song list exposes a countable list and that each song title is a heading at the expected level
- [x] 4.10 Raise `UNDO_WINDOW_MS` to 10s, keeping the toast `durationMs` bound to the same constant (**H5**, per design D7)
- [x] 4.11 Pause both the removal timer and the toast dismiss timer on hover and on focus-within the toast, and resume on leave/blur (**H5**)
- [x] 4.12 Add tests: the window pauses while hovered, pauses while focus is inside, resumes on leave, Undo before expiry cancels the `DELETE`, and expiry still issues it
- [x] 4.13 Confirm the `pagehide` / unmount keepalive flush still carries out a pending removal after the timing change (**H5**)
- [x] 4.14 Render `affinityReason` from the API response instead of discarding it, and show the "log out and back in" instruction only for the missing-scope cause (**H7**)
- [x] 4.15 Add a test asserting a non-scope reason is surfaced verbatim and does not carry the log-out instruction
- [x] 4.16 Make the whole playlist row on `/clean` the navigation target (currently 422×24 inside a 60px row) and add a hover state (**M1**)
- [x] 4.17 Add a test asserting the row target is at least 44px tall and spans the row
- [x] 4.18 Add a type-to-filter field to the playlist dialog in `playlist-list.tsx`, preserving already-selected playlists while filtered (**M11**)
- [x] 4.19 Add a test asserting filtering narrows the list and that a selection made before filtering survives it
- [x] 4.20 Extend the album-line guard in `song.tsx` to skip the album when it matches the artist as well as when it matches the track title (**M8**)
- [x] 4.21 Replace `<p>Redirecting...</p>` in `app-shell.tsx` with the themed auth shell and existing spinner, so the state honors the current theme (**M12**)

## 5. Visual language — gradient and glass removal

- [x] 5.1 Add the verified token values from design D2 to both theme blocks in `ui/src/app/globals.css`: `--card`, `--brand-green`, `--brand-green-border`, `--brand-accent-border`, `--muted-foreground`, `--border`, `--input`, `--brand-footer`, `--brand-destructive` — every one defined in **both** light and dark
- [x] 5.2 Register the new brand tokens in `ui/tailwind.config.ts` alongside the existing `brand` scale
- [x] 5.3 Rewrite the `brand` button variant in `ui/src/components/ui/button.tsx`: flat `--brand-green` fill, `--brand-on-accent` text, `--brand-green-border` border. Delete the `linear-gradient(90deg, ...)` background (**gradient removal**, per design D1)
- [x] 5.4 Rewrite the `brandMuted` variant as a transparent fill with a `--brand-accent-border` border and `--brand-body` text. Delete the `--brand-btn-muted-bg` gradient (**gradient removal**, **H1**)
- [x] 5.5 Delete the `--brand-btn-muted-bg`, `--brand-btn-primary-border` and `--brand-auth-bg`/`--brand-app-bg` gradient tokens, replacing the two page-background tokens with flat surfaces (**gradient removal**)
- [x] 5.6 Remove `rounded-md` from the `sm` button size so variants own shape, and confirm "add to playlists" and "Refresh from Spotify" now match every other `brand` button (**M9**)
- [x] 5.7 Add a destructive button variant using `--brand-destructive` and apply it to the removal control on `/clean/[playlistId]`, replacing `brandMuted` (**H1**, destructive-treatment requirement)
- [x] 5.8 Replace `.glass-surface` with a flat opaque card class drawn from `--card`; delete `backdrop-filter` / `-webkit-backdrop-filter` (**L4**, **glass removal**)
- [x] 5.9 Differentiate the page-level container treatment from the list-row treatment, so a card and a row are no longer identical surfaces (**glass removal**, per `ui-design-system`)
- [x] 5.10 Update every `.glass-surface` call site — landing, login, callback spinner, song rows, playlist container — to the new surface classes
- [x] 5.11 Pass a real `value` to the "Songs per page" `Select` so its current value leaves the placeholder slot and is rendered as content (**H3**, per design D3)
- [x] 5.12 Confirm the select trigger's border now resolves from the retinted `--input` and reaches 3:1 against the page background in both themes (**H2**)
- [x] 5.13 Reveal the play control on hover and focus using the existing `group-hover` scaffolding, and give it a quieter treatment than the primary filing action so the card has one clear primary (**M6**)
- [x] 5.14 Add a contrast test suite that resolves each token pair and asserts against the floor — 4.5:1 for text, 3:1 for control boundaries — in both themes, per design D8
- [x] 5.15 Add a test asserting no element in any route resolves a computed background image containing a gradient function (**gradient removal**)
- [x] 5.16 Add a test asserting the `brand` variant's border actually resolves, not just that the class string is present (per design risk on `cn()` merges)
- [x] 5.17 Walk every route in both themes and confirm the retinted `--muted-foreground`, `--border` and `--input` have not regressed the dialog, checkbox or select
- [x] 5.18 Update the existing suites that assert on gradient classes, `glass-surface`, or the old pagination markup

## 6. Hygiene and documentation

- [x] 6.1 Fix the three `react-hooks/set-state-in-effect` errors in `app-shell.tsx` (×2) and `callback/ClientComponent.tsx` (**L1**)
- [x] 6.2 Add the missing `displayName` to the memoised `SongCard` (**L1**)
- [x] 6.3 Clear the `react-hooks/exhaustive-deps` and unused-variable warnings, and confirm `npm run lint` exits clean (**L1**)
- [x] 6.4 Replace `onRefresh={() => {}}` in `clean/[playlistId]/page.tsx` with a stable reference — a module-level no-op or an optional prop — so `React.memo` on `SongCard` stops being defeated (**L2**)
- [x] 6.5 Move `ToastProgressBar` from animating `width` to `transform: scaleX()` with `transform-origin: left`, keeping the `motion-reduce` escape hatch (**L3**)
- [x] 6.6 Remove the unused `cross-fetch` production dependency (**L6**)
- [x] 6.7 Remove the stray top-level `"transform"` key from `ui/package.json`, or fold it into `jest.config.js` if it was meant to do something (**L7**)
- [x] 6.8 Delete the empty `ui/src/types/index.d.ts` and remove the resolved Known Gap #4 (`ui/src/styles/globals.css`, which no longer exists) from `CLAUDE.md` (**L8**)
- [x] 6.9 Update the Design Context section of `CLAUDE.md` — it currently names glassmorphism and green-to-blue gradients as the approach to preserve, which this change removes
- [x] 6.10 Update `architecture.svg` if any component boundary moved during the extraction in stage 2

## 7. Verification

- [x] 7.1 Run the full frontend suite: `cd ui && npm test -- --runInBand`
- [x] 7.2 Run `npm run lint` and confirm zero errors and zero warnings
- [x] 7.3 Instrument every route at 320px, 375px and 1280px in both themes; confirm no horizontal overflow and no contrast floor below its threshold
- [x] 7.4 Traverse every route by keyboard and confirm each focused control shows a visible indicator against its surface in both themes
- [x] 7.5 Confirm all 28 audit findings are closed, and note explicitly which remain open by design (the centered-column layout, the single-typeface treatment, and the uniform card grid, all named out of scope in the proposal)
