## 1. Phrase set and caret styling

- [x] 1.1 Create `ui/src/components/ui/typing-headline.tsx` exporting a `LANDING_HEADLINE_PHRASES` constant with the three phrases in declaration order: `put your liked songs where they belong`, `clear out the songs you've stopped playing`, `grow one playlist from another` (design D7).
- [x] 1.2 Add a step-based caret blink `@keyframes` and its class to `ui/src/app/globals.css`, with the caret sized as a fixed-width `inline-block` so blinking never reflows the phrase (design D6, D5). Confirm the existing blanket `prefers-reduced-motion` block at the bottom of the file already neutralizes it.

## 2. The reveal state machine

- [x] 2.1 Implement the `{ phraseIndex, charCount, phase }` state in `typing-headline.tsx` with `phase ∈ { typing, holding, erasing }`, and a single `setTimeout` scheduled per committed step — no intervals, no `requestAnimationFrame`, no clock reads (design D1).
- [x] 2.2 Wire the phase transitions: `typing` advances `charCount` until it equals the phrase length then goes to `holding`; `holding` waits the hold interval then goes to `erasing`; `erasing` decrements `charCount` to 0 then advances `phraseIndex` (wrapping to 0 past the last phrase) and returns to `typing`. Erase speed faster than type speed, within ~2× (design D1, risks).
- [x] 2.3 Clear the pending timeout in the scheduling effect's cleanup so no timer survives unmount (design risks).
- [x] 2.4 Render only an exact prefix of the active phrase — never a partial character, placeholder, or ellipsis.

## 3. Pause on hover and focus

- [x] 3.1 Track `isHovered` (`onMouseEnter` / `onMouseLeave`) and `hasFocusWithin` (`onFocus` / `onBlur`) as two independent state flags on the heading, and derive `paused = isHovered || hasFocusWithin` (design D4).
- [x] 3.2 Make the scheduling effect schedule nothing while `paused` is true, leaving `charCount` and `phase` untouched so the frozen text is exactly what was rendered; resuming schedules the next step in the same direction.
- [x] 3.3 Add the code comment explaining why `hasFocusWithin` is tracked when the heading has no focusable children today (design D4) — so it doesn't read as dead code in review.

## 4. Reduced motion

- [x] 4.1 Resolve `window.matchMedia("(prefers-reduced-motion: reduce)").matches` in a mount effect into state — not at module scope, so SSR and first client paint agree (design D3).
- [x] 4.2 When reduced motion is preferred, render `phrases[0]` complete with no caret element, and return from the scheduling effect before any timer is created.

## 5. Accessible exposure

- [x] 5.1 Put the complete active phrase on the `<h1>` as `aria-label`, and mark the animating prefix span and the caret `aria-hidden="true"` (design D2).
- [x] 5.2 Confirm no `aria-live`, `role="status"`, or `role="alert"` is introduced anywhere in the headline.
- [x] 5.3 Verify the landing page still exposes exactly one level-1 heading.

## 6. Layout stability

- [x] 6.1 Give the `<h1>` a responsive `min-h-[...]` sized to the tallest phrase at each breakpoint, keeping the existing `text-3xl sm:text-4xl` type scale (design D5).
- [x] 6.2 Check at a narrow viewport (~375px) that the tool buttons below the headline do not move as phrases reveal, wrap, or erase.

## 7. Wire into the landing page

- [x] 7.1 Replace the static `<h1>` in `ui/src/app/page.tsx` with `<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />`, leaving the eyebrow `<p>`, the "pick a tool below" subhead, and all three tool buttons and their descriptions untouched.
- [x] 7.2 Confirm the eyebrow plus any single phrase still reads as one grammatical sentence.

## 8. Tests

- [x] 8.1 Create `ui/src/components/ui/typing-headline.test.tsx` using `jest.useFakeTimers()` and `act`, importing the real phrase constant rather than hard-coding copy.
- [x] 8.2 Test the reveal: advancing timers yields specific growing prefixes at specific elapsed times, ending at the complete phrase — not a vacuous "something changed" assertion (design risks).
- [x] 8.3 Test the hold: the complete phrase stays unchanged across the hold interval before any character is removed.
- [x] 8.4 Test the erase: prefixes shrink from the end, one character at a time, to empty.
- [x] 8.5 Test rotation order and wrap: phrase 1 → 2 → 3 → 1, driving at least one full cycle.
- [x] 8.6 Test pause on hover mid-phrase: text frozen exactly as rendered; and resume continues from that character in the same direction.
- [x] 8.7 Test pause on focus, and that leaving the pointer while focus remains inside keeps it paused (the D4 case).
- [x] 8.8 Test reduced motion by overriding the `jest.setup.ts` `matchMedia` stub to return `matches: true`: full first phrase rendered, no caret, and advancing timers changes nothing.
- [x] 8.9 Test the caret is present at the empty boundary between phrases.
- [x] 8.10 Test unmount clears the pending timer — no state update after unmount, no act warning.
- [x] 8.11 Test the `<h1>`'s accessible name is a complete phrase mid-reveal, and that the caret contributes no characters to it.
- [x] 8.12 Update `ui/src/app/page.test.tsx` so heading assertions use `getByRole("heading", { level: 1, name })` instead of visible-text matching; leave the three button-routing tests and the button-description test as they are.

## 9. Verify and document

- [x] 9.1 Run `cd ui && npm test -- --runInBand` — all suites green, coverage thresholds still met.
- [x] 9.2 Run lint and `tsc --noEmit` clean.
- [x] 9.3 Verify in the running dev server: the rotation cycles, hovering freezes it, and the buttons below don't shift. Check both light and dark mode.
- [x] 9.4 Update `CLAUDE.md` (frontend structure — the new shared component; landing-page behavior) and `CONTEXT.md` to describe the rotating headline, its pause contract, and its reduced-motion fallback.
- [x] 9.5 Confirm `architecture.svg` needs no edit — no endpoint, route, service, page, or data-flow change.

## 10. Sign-in screen: cycle only the verb

- [x] 10.1 Add optional `prefix`/`suffix` props to `TypingHeadline` so a surface can hold part of the line static and animate only the rest, reusing the existing state machine rather than duplicating it.
- [x] 10.2 Render the caret between the cycling word and the static suffix, so it marks the typing position rather than the end of the line.
- [x] 10.3 Build the `aria-label` from `prefix + activePhrase + suffix`, and apply the same composition to the reduced-motion branch.
- [x] 10.4 Export `LOGIN_HEADLINE_VERBS` (`organize`, `clean`, `propagate`) — one verb per tool, single source of truth like the landing set.
- [x] 10.5 Replace the login page's static `<h1>` with `<TypingHeadline phrases={LOGIN_HEADLINE_VERBS} prefix="better " suffix=" your songs" />`, leaving the eyebrow, body copy, and Log in button untouched.
- [x] 10.6 Measure the tallest wrapped state at each breakpoint and set `min-h` accordingly (narrow wraps to 3 lines on `propagate`; 2 lines at `sm`+), then verify the Log in button does not move across a full cycle.
- [x] 10.7 Re-measure the landing headline the same way and tighten its over-reserved `min-h` (was 10rem/6rem, measured 9.375rem/5rem).
- [x] 10.8 Add component tests for the prefix/suffix shape: static text held still, verb-only erase, verb rotation and wrap, whole-sentence accessible name mid-word, reduced-motion sentence.
- [x] 10.9 Add a login page test asserting the heading's accessible name is the full sentence around the first verb.
- [x] 10.10 Update `CLAUDE.md`, `CONTEXT.md`, and the change's spec delta to cover the second surface.
