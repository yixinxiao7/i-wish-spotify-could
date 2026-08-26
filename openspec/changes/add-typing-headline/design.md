## Context

See `proposal.md` — Why. Constraints that shape the approach:

- The landing page (`ui/src/app/page.tsx`) is already `"use client"`, and its `<h1>` sits directly under a static eyebrow `<p>` reading "I Wish Spotify Could". The phrase has to complete that sentence, so the eyebrow stays a sibling and only the `<h1>`'s contents change.
- `globals.css` already has a blanket `@media (prefers-reduced-motion: reduce)` rule that collapses **CSS** animation and transition durations to `0.01ms`. It does nothing to a JS timer loop, so this feature must detect the preference itself — the same way `playlist-list.tsx:63` does for its FLIP reorder.
- The project already has a precedent for "a timed thing that pauses on hover/focus": `useDeferredRowAction` + `ToastProvider`. That establishes the expected shape (pause is a first-class state, not a `setInterval` that gets cleared and restarted from zero).
- `jest.setup.ts` stubs `window.matchMedia` to always return `matches: false`, so reduced-motion tests must override it per-test. Jest runs jsdom with `--runInBand`; timer-driven behavior is testable with `jest.useFakeTimers()` + `act`.
- Coverage thresholds are 85% global (project convention aims for 90%), so the reveal machinery needs to be reachable from tests without racing real wall-clock time.

## Goals / Non-Goals

**Goals:**

- One presentational component owning the whole reveal lifecycle, so `page.tsx` stays declarative — it passes phrases and renders a heading.
- Deterministic, fake-timer-friendly timing: every state transition is driven by a scheduled callback, never by `requestAnimationFrame` or by reading the clock.
- The accessible name of the `<h1>` is always a *complete* phrase, decoupled from the animating visible text.
- Reduced motion is a hard branch — it doesn't merely shorten durations, it never schedules anything.

**Non-Goals:**

- No generalized text-animation library, easing options, or per-character effects beyond the reveal/erase described in the spec.
- No persistence of which phrase the user last saw; every visit starts at phrase 1.
- No `IntersectionObserver` / visibility-based suspension. The headline is above the fold on the only page that uses it; adding tab-visibility handling is speculative complexity.
- No route or backend change; nothing touches `architecture.svg`.

## Decisions

### D1: A single scheduled-step state machine, not two nested intervals

The component holds `{ phraseIndex, charCount, phase }` where `phase ∈ { typing, holding, erasing }`, and after each committed render schedules exactly one `setTimeout` for the next step. The delay is chosen by phase: type speed, hold duration, erase speed (erase faster than type — that's what real backspacing feels like, and it keeps the dead time between phrases short).

*Why over the alternative:* a `setInterval` per phase plus a `setTimeout` for the hold means three timers whose lifetimes overlap at every transition, and pausing means cancelling and reconstructing them with hand-computed remainders. With one pending timeout, pause is "don't schedule the next one" and resume is "schedule it now" — no remainder arithmetic, and the frozen text is already correct because it's just state. This directly buys the spec's "resume from exactly where it suspended".

*Trade-off accepted:* resume restarts the current step's delay rather than continuing its remaining fraction. At ~55ms per character that's invisible, and the spec constrains *which character* it resumes at, not sub-step timing.

### D2: Visible text and accessible name are separate DOM

```
<h1 aria-label={fullPhraseOfActivePhrase}>
  <span aria-hidden="true">{visiblePrefix}<span className="caret" /></span>
</h1>
```

The `<h1>` carries the complete active phrase as its accessible name; the animating prefix and the caret are both `aria-hidden`. No `aria-live` anywhere.

*Why over the alternatives:* a visually-hidden `<span className="sr-only">` holding the full phrase alongside the animating text would also work, but it puts two text nodes in the heading and risks both being concatenated by some AT. Marking the whole heading `aria-hidden` would remove the page's only `<h1>` from heading navigation. Using `aria-live` would announce every keystroke — the exact failure the spec forbids.

*Consequence for tests:* `page.test.tsx` asserts landing copy by visible text today. Heading assertions become `getByRole("heading", { level: 1, name: "..." })`, which reads the `aria-label`, so they stay stable regardless of where the animation happens to be.

### D3: Reduced motion resolved once, at mount, into state

An effect reads `window.matchMedia("(prefers-reduced-motion: reduce)").matches` on mount and stores it; when true, the scheduling effect returns early and the component renders `phrases[0]` whole with no caret element at all.

*Why at mount and not at module scope:* the component must render identically on the server and on the first client paint (Next.js hydration) — `matchMedia` doesn't exist during SSR. Resolving in an effect means the first paint is the un-animated first phrase, which is also the correct final state for reduced-motion users, so they never see a flash of animation.

*Why not subscribe to `change`:* changing the OS motion preference mid-session on a landing page is not a case worth the listener. Documented as a deliberate omission; a reload picks it up. (Consistent with `playlist-list.tsx`, which also samples the query rather than subscribing.)

### D4: Pause is one derived boolean from two independent flags

`isHovered` (from `onMouseEnter`/`onMouseLeave` on the heading) and `hasFocusWithin` (from `onFocus`/`onBlur` with React's bubbling focus events) are tracked separately; `paused = isHovered || hasFocusWithin`. The scheduling effect lists `paused` as a dependency and schedules nothing while it's true.

*Why two flags rather than one:* the spec requires the headline to stay suspended when the pointer leaves but focus is still inside. A single flag toggled by four handlers gets that case wrong.

*Note:* the `<h1>` itself is not focusable and contains no interactive children today, so `hasFocusWithin` is a forward-looking guarantee (and a cheap one). It is specified because WCAG 2.2.2 asks for a mechanism that doesn't require a pointer; if the headline never becomes focusable, reduced-motion remains the non-pointer escape hatch. **This is the one place the design is deliberately more permissive than today's markup requires** — flagged so a reviewer doesn't read it as dead code.

### D5: Layout stability via a reserved min-height, not a fixed height

The `<h1>` gets a `min-h-[...]` sized to the tallest phrase at each breakpoint, paired with the existing responsive type scale (`text-3xl sm:text-4xl`). The caret is `inline-block` with a fixed width so it doesn't reflow text as it blinks.

*Why min-height over a hard height:* a hard height clips if the browser's font metrics differ from what the value was tuned against, or if a user zooms text. `min-height` degrades by growing, which shifts content once at load rather than on every phrase change — and the phrases are authored short enough that the tallest-at-narrowest case is the one that sets the value.

*Alternative rejected:* rendering all phrases stacked with `visibility: hidden` to let the tallest size the box. Correct at any font size, but it duplicates every phrase into the DOM where AT and `getByText` can find it, which fights D2.

### D6: The caret blinks in CSS, the text animates in JS

A `@keyframes` step-based blink in `globals.css` on the caret element. The blanket reduced-motion rule already neutralizes it, and in reduced-motion mode the caret isn't rendered at all — belt and braces.

*Why not blink from the same state machine:* it would double the timer's tick rate for something purely decorative and make every text-progression test contend with blink ticks.

### D7: Phrases live in one exported constant, adjacent to the component

`LANDING_HEADLINE_PHRASES` is exported from the component's module and consumed by `page.tsx`. The spec requires a single place to edit the claims; a module constant satisfies that and lets tests import the real copy instead of hard-coding strings that can drift.

## Risks / Trade-offs

- **Fake-timer tests become the primary coverage vehicle, and fake-timer tests are easy to write in a way that passes vacuously** (advance timers, assert nothing changed) → Each timing test asserts a *specific* prefix at a *specific* elapsed time, and at least one test asserts the full cycle wraps from the last phrase back to the first.
- **Erase-then-type means the headline is empty (caret only) for one tick between phrases**, which can read as a glitch if the erase and type speeds are tuned too far apart → The spec requires the caret visible at that boundary specifically so the empty moment reads as intentional; keep erase speed within ~2× of type speed.
- **`aria-label` on an `<h1>` overrides its text content for AT**, so if the label and the phrase set ever drift, sighted and non-sighted users see different claims → Both come from the same `phrases[phraseIndex]` value; there is no second source to drift from.
- **Timers left running after navigation** would keep firing `setState` on an unmounted component → The scheduling effect's cleanup clears the pending timeout; covered by an explicit unmount test.
- **Reduced-motion users only ever see phrase 1 in the headline**, so two of three tools are unrepresented there → The three tool buttons below the headline already carry a description each; the spec makes that an explicit requirement rather than an accident, and the button descriptions must not be removed without revisiting it.
- **Total cycle length is ~4–6s per phrase, ~15s for a full rotation.** A user who reads the page in under 5 seconds sees one or two phrases → Acceptable: the buttons are the actual information architecture, the headline is character.

## Migration Plan

Not applicable — a single frontend component swap with no data, no API surface, and no persisted state. Rollback is reverting the commit; there is nothing to undo server-side.

## Open Questions

None. Phrase set, reduced-motion behavior, and the pause mechanism were settled with the user before drafting; timing constants are tuning values that can be adjusted after seeing it run without changing the spec, the approach, or the task breakdown.
