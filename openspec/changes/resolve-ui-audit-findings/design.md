## Context

See `proposal.md` — Why. The constraints that shape the approach:

**Two neutral families are in the stylesheet.** Every token inherited from shadcn is warm and stone-hued (`--muted-foreground: 25 5.3% 44.7%`, `--border: 20 5.9% 90%`, `--input`, `--ring`, `--primary: 24 9.8% 10%`). Every brand token is cool teal-green. Four separate audit findings are the same collision seen from four places, so they are fixed once, at the token layer, not four times at the component layer.

**The current card surface is translucent.** `.glass-surface` composites `rgba(255,255,255,0.86)→rgba(240,250,246,0.76)` over the page gradient, so a "card background" has no single value to measure contrast against — it depends on where on the gradient the card sits. Going flat and opaque is what makes the contrast floors in `ui-design-system` checkable at all.

**The two list pages are near-duplicates.** `SongCardSkeleton` is copy-pasted verbatim into both, and each carries its own ~65-line pagination block and its own `handleOffsetChange`. Three of the findings would otherwise need fixing twice, and one of them (page-size handling) is already fixed in one copy and broken in the other.

**Contrast values below were computed, not estimated.** Every ratio quoted here was calculated against the actual rendered surfaces at the sRGB values the tokens resolve to.

## Goals / Non-Goals

**Goals:**

- Make every contrast floor in `ui-design-system` mechanically checkable — one opaque token per surface, one flat token per accent, no composited translucency in the measurement path.
- Fix each shared defect in one place: extract the duplicated skeleton and pagination before fixing them.
- Keep the token *names* stable so component call sites mostly do not move; the change is concentrated in `globals.css`, `tailwind.config.ts`, and `button.tsx`.
- Land the critical reflow fix independently of the visual work, so it is not gated on the redesign.

**Non-Goals:**

- Adopting a new component library, or replacing Radix/shadcn.
- Changing any backend endpoint, service, or runtime-state file.
- The layout and typography anti-patterns (centered-column template, single typeface, uniform card grid). Named out of scope in the proposal; they need a layout direction, and a token pass cannot supply one.
- Reaching WCAG AAA. The target is AA, plus the 44px target size from 2.5.5 which the codebase already aims at.

## Decisions

### D1: Flat Spotify-green fill with a darker green border, not a darker green fill

The primary action becomes a flat `--brand-green` fill with the existing near-black `--brand-on-accent` text.

The problem: no single green satisfies both floors at once in light mode. Computed against a flat near-white card:

| Green | Boundary vs card | Near-black text on it | White text on it |
|---|---|---|---|
| `141 73% 45%` (bright) | **2.21** ✗ | **6.06** ✓ | 2.16 ✗ |
| `141 73% 38%` | 3.12 ✓ | **4.37** ✗ | 3.00 ✗ |
| `131 62% 40%` | 3.20 ✓ | **4.26** ✗ | 3.08 ✗ |
| `145 65% 30%` (dark) | 5.09 ✓ | 2.68 ✗ | **4.89** ✓ |

Darkening the fill until it clears 3:1 as a boundary pushes the near-black text below 4.5:1; darkening further to take light text loses the Spotify green entirely.

**Decision**: keep the bright fill and let a **border** carry the boundary — which is exactly the mechanism WCAG 1.4.11 contemplates, and the same mechanism the outlined secondary uses. `--brand-green-border: 141 73% 34%` measures 3.76:1 against the flat card and 3.11–3.28:1 against every stop of the page gradient. Dark mode needs no border: the bright fill is already 7.6:1 against the dark card.

*Alternative rejected*: darker fill with light text (`145 65% 30%`). It passes cleanly and needs no border, but the user chose "flat Spotify green" specifically, and a green that dark stops reading as Spotify green.

*Alternative rejected*: a shadow instead of a border. Shadows do not count toward non-text contrast and would leave the boundary unverifiable.

### D2: Verified token values

Every value below was computed against the flat surfaces this change introduces. The floors are 3:1 for boundaries, 4.5:1 for text.

**Surfaces** — replacing the translucent glass:

| Token | Light | Dark | Note |
|---|---|---|---|
| `--card` | `170 30% 99%` | `180 12% 10%` | tinted toward brand rather than pure white / pure black |

**Accent**:

| Token | Light | Dark | Verified |
|---|---|---|---|
| `--brand-green` (fill) | `141 73% 45%` | `141 73% 45%` | on-accent text 6.06:1 both themes |
| `--brand-green-border` | `141 73% 34%` | *(none needed)* | 3.76:1 vs card; 3.11:1 vs page bg |

**Outlined secondary** — replacing `brandMuted`'s near-white gradient fill:

| Token | Light | Dark | Verified |
|---|---|---|---|
| `--brand-accent-border` | `198 45% 45%` | `198 30% 45%` | light 4.00:1 vs card, 3.24:1 vs page bg; dark 4.00:1 vs card |

**Retinted neutrals** — moved from the warm stone ramp onto the brand's cool ramp:

| Token | Was | Light | Dark | Verified |
|---|---|---|---|---|
| `--muted-foreground` | `25 5.3% 44.7%` | `190 22% 37%` | `190 14% 64%` | light 4.62:1 vs page bg, 5.59:1 vs card; dark 6.72:1 / 7.20:1 |
| `--border` / `--input` | `20 5.9% 90%` | `190 20% 46%` | `190 15% 42%` | light 3.27:1 vs page bg, 4.03:1 vs card; dark 3.54:1 both |
| `--brand-footer` | `20 10% 8%` (dark) | *(unchanged)* | `190 18% 7%` | removes the warm/cool seam; body text on it 17.8:1 |

**Destructive** — new, for the removal control:

| Token | Light | Dark | Verified |
|---|---|---|---|
| `--brand-destructive` | `0 60% 42%` | `6 65% 70%` | 6.74:1 light / 6.78:1 dark, both as boundary and as text-on-fill |

The existing text tokens (`--brand-heading`, `--brand-body`) already clear AA against the new flat card — 7.97:1 and 9.22:1 in light — and do not move.

### D3: `--muted-foreground` is retinted, but the select's *value* stops using it

Finding H3 has two causes and both need fixing. The token is too light (3.78:1) *and* the current page-size value is rendered through `<SelectValue placeholder={limit} />`, which puts a live value into the placeholder slot that shadcn deliberately mutes.

Retinting alone would make the muted grey legible but would still style content as a prompt. The fix is both: retint the token per D2, and pass a real `value` to the `Select` so the trigger leaves its placeholder state. The second half is also what makes finding M3 fixable — an uncontrolled `Select` cannot reflect a page size that changed for any other reason.

### D4: Pagination adapts below `sm` rather than scrolling or shrinking

At 320px the numbered strip measures 428px; the document scrolls 54px sideways. Three options were considered:

- **Shrink the controls** — would breach the 44px target floor. Rejected.
- **Wrap or horizontally scroll the strip** — keeps every control reachable, but a nested horizontal scroller inside a vertically scrolling page is a poor affordance on touch, and the user still cannot see where they are.
- **Adapt the control** *(chosen)* — below `sm`, render Previous / "Page 3 of 49" / Next and drop the numbered links. Three targets, ~240px, always fits; and the position readout replaces information the numbers were carrying, satisfying the spec's requirement that position stays legible.

Jumping to an arbitrary page is lost on phones. That is an acceptable trade: with 49 pages the numbered strip only ever offered first, last, and ±1 anyway, and first/last remain reachable from the ends.

### D5: Extract the shared list machinery before fixing it

`SongCardSkeleton` and the pagination block are lifted into shared components before any behavioral fix lands, so C1, H4, M2 and M3 are each written once.

The extracted skeleton takes the same `className` its sibling `SongCard` takes; the width mismatch (1024px placeholder, 499px card) is a consequence of the skeleton never receiving the caller's width classes, so passing them through is the fix rather than hard-coding a second width.

The two `handleOffsetChange` implementations are already near-identical and carry a comment saying so. The page-size handler is the one place they diverge — `/clean/[playlistId]` resets correctly, `/organize` does not — so the extracted component adopts the correct behavior and `/organize` inherits it.

*Alternative rejected*: fix in place and extract later. Three of these findings would need two edits each, and the divergence that caused M3 would survive.

### D6: Two live regions, not one

The toast host is currently one container carrying `role="status" aria-live="polite" aria-atomic="true"` for both toast kinds. That single container causes two findings at once: errors are announced politely (M10a), and `aria-atomic` on the *container* means each new toast re-reads the ones already in it (M10b).

Split into two sibling regions — `role="status"` for success, `role="alert"` for errors — and move `aria-atomic="true"` down onto the individual toast, where it means "read this toast as a unit" rather than "read the whole stack".

Separately, `aria-live="polite"` comes off the cleanup page's song-list container entirely (H6). Nothing replaces it: removals are already announced by the toast region, and loading already has its own `role="status"`. Adding a third announcement channel is what created the problem.

### D7: The undo window pauses rather than simply lengthening

Finding H5 is a WCAG 2.2.1 concern: 5 seconds is the entire budget for a screen-reader user to hear the announcement, navigate to the toast, and activate Undo.

The window is raised to 10 seconds and, more importantly, **pauses on hover and on focus-within** — the removal timer and the toast's own dismiss timer pause together, so the affordance cannot vanish out from under a user who is reaching for it. `UNDO_WINDOW_MS` and the toast `durationMs` stay bound to the same constant, which is what the existing code comment already insists on.

The `pagehide` / unmount flush stays exactly as it is. It is the reason a pending removal is not silently dropped on navigation, and pausing does not interact with it: a paused timer that never fires is still flushed on the way out.

*Alternative rejected*: an undo bar persisting until dismissed. Better still, but it is a new component and a new layout region; pausing gets the compliance win inside the existing shape.

### D8: Test strategy — assert the floors, not the values

The contrast floors are the requirement; the hex values are an implementation detail that will be tuned. Tests compute the ratio from the resolved token values and assert against the floor, so a later palette adjustment that still passes does not break the suite, and one that quietly regresses does.

Existing suites that assert on gradient classes, `glass-surface`, or pagination markup are updated as those change. The responsive pagination collapse and the undo pause both get new coverage.

## Risks / Trade-offs

- **A large visual diff makes review hard, and a regression could hide in it** → Sequence the work so the critical reflow fix (C1) and the extraction (D5) land before any color moves. Colors change in one commit touching `globals.css`, `tailwind.config.ts` and `button.tsx`, which is reviewable as a unit.

- **The bright-green-plus-border approach depends on the border actually rendering** → A `1px` border at 3.76:1 is the sole thing making the primary button identifiable in light mode. If it is ever dropped by a `cn()` merge — which is precisely how M9 happened to `rounded-full` — the button silently fails 1.4.11. Mitigation: assert the resolved border in a test, not just the class string.

- **`--muted-foreground`, `--border` and `--input` are used by every shadcn component, including ones not in the audit's path** → Retinting them will move the appearance of the dialog, checkbox and select in ways not individually enumerated. Mitigation: the values were chosen to be *darker* than the originals in light mode, so anything currently passing continues to pass; walk each component visually in both themes.

- **Dropping numbered pagination on phones removes a capability** → Direct jumps to an arbitrary page are gone below `sm`. Accepted per D4; first and last remain reachable and the position readout is new information the numbered strip never gave.

- **Raising the undo window to 10 seconds keeps a removal pending longer** → A user who removes several songs quickly accumulates more pending deletes, and each is still flushed on `pagehide`. The existing keepalive flush already handles this; the only change is that the pending set can be slightly larger.

- **`CLAUDE.md`'s design context names glassmorphism and gradients as the approach to preserve** → It will contradict the code the moment this lands. It is updated in the same change; leaving it stale would send the next contributor to reinstate exactly what is being removed.

## Migration Plan

Frontend-only, no data migration, no API change. Deployment is a normal frontend deploy.

The work is sequenced so each stage is independently shippable:

1. **Reflow fix** — C1 alone. Ships the moment it is ready; it is the only finding blocking a core flow.
2. **Extraction** — shared skeleton and pagination. No behavior change; a pure refactor that makes stage 3 single-edit.
3. **Correctness** — the list-navigation and feedback findings.
4. **Visual language** — tokens, gradient removal, glass removal. The largest diff and the only one with a rollback consideration.
5. **Hygiene** — lint, dependencies, docs.

**Rollback**: stage 4 is a revert of the token and variant commits; nothing else depends on the new token values, and stages 1–3 are independent of it. Stages 1–3 and 5 are individually revertable.

## Open Questions

- Whether `--primary` and `--ring` should also move onto the cool ramp. They currently pass their contrast floors as warm values, so this change leaves them alone. It is a cohesion question rather than a compliance one, and can be answered after the rest of the palette is in place without changing the specs or the task breakdown.
