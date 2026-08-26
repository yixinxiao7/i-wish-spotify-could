## Why

The landing page's headline still reads "put your liked songs where they belong" — a single, static claim that described the app when categorizing liked songs was all it did. The app now also cleans stale songs out of a playlist and propagates songs between playlists, so the headline undersells two of its three tools and quietly contradicts the three buttons sitting directly beneath it.

Rather than flattening the line into a generic summary, the headline should cycle through one phrase per tool, typed and erased at a visible insertion point. That keeps the "I Wish Spotify Could ___" conceit that gives the app its name and its character, while making the full scope of the app legible in the first few seconds — which is exactly the "bold, expressive" register the product is aiming for.

## What Changes

- The landing page's static `<h1>` becomes a **rotating headline** that cycles through three phrases, one per tool, looping indefinitely:
  1. `put your liked songs where they belong` (categorize)
  2. `clear out the songs you've stopped playing` (clean up playlists)
  3. `grow one playlist from another` (propagate)
- Each phrase is revealed **character by character** ("typed"), held, then removed character by character ("backspaced"), before the next phrase types in.
- A **blinking insertion caret** sits at the end of the currently rendered text so the effect reads as keyboard input rather than a fade or a wipe.
- The animation **pauses while the pointer is over the headline or keyboard focus is inside it**, and resumes on leave/blur — the same pause-on-interaction contract the undo toast already honors, satisfying WCAG 2.2.2 without adding visible chrome.
- Under `prefers-reduced-motion: reduce` the headline is **completely still**: phrase 1 renders whole, with no caret and no rotation.
- The headline is **announced once, not per keystroke**, to assistive technology — a partially typed phrase is decorative noise, not content.
- The reveal mechanism is a **reusable presentational component**, not landing-page-local logic, so a second surface can adopt it without duplicating the timing machinery.

Non-goals: no change to the eyebrow label, the "pick a tool below" subhead, the three tool buttons, or their descriptions; no backend change; no new dependency.

## Capabilities

### New Capabilities
- `landing-headline`: What the app's entry point claims it can do, and how that claim is presented — the rotating phrase set, the typing/erasing reveal, its pause and reduced-motion contracts, and how it is exposed to assistive technology.

### Modified Capabilities

_None._ The propagation, cleanup, and categorization capabilities each already specify that the entry point offers their action; this change touches the headline above those actions, not the actions themselves.

## Impact

- **Frontend only.** `ui/src/app/page.tsx` (headline markup), one new component under `ui/src/components/ui/`, and its test file. Likely a keyframe or utility for the caret in `ui/src/app/globals.css`.
- **Tests.** `ui/src/app/page.test.tsx` currently asserts static landing copy; it needs the headline's accessible text to remain assertable while the visible text animates. New unit tests cover the reveal cycle, pause/resume, reduced motion, and cleanup on unmount.
- **Docs.** `CLAUDE.md` and `CONTEXT.md` gain the new shared component; `architecture.svg` needs no change (no endpoint, route, service, or data-flow change).
- **No backend, API, dependency, or deployment impact.**
