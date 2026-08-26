## Purpose

Defines what the app's entry points claim they can do and how those claims are presented: a set of phrases — one per tool the app offers — that complete the app's name, revealed one character at a time at a visible insertion point so the entry point reads as something being typed rather than a fixed banner. It exists because a single static claim can only ever describe one of the app's tools. It covers both entry points that carry such a headline: the signed-in landing screen and the sign-in screen.

## ADDED Requirements

### Requirement: The headline covers every tool the app offers

The entry point's headline SHALL present a set of phrases, each of which names a distinct thing the app does, so that no tool the app offers is absent from the headline.

Each phrase SHALL be written to complete the app's name as a sentence, so that the eyebrow label and the phrase read continuously.

The phrase set SHALL cover, at minimum: filing liked songs that are in no playlist, removing songs the user no longer plays from a playlist, and copying songs from one playlist into another.

#### Scenario: Every tool is represented

- **WHEN** the headline's full phrase set is examined
- **THEN** each of the app's tools SHALL be described by at least one phrase

#### Scenario: A phrase completes the app's name

- **WHEN** any single phrase is read together with the eyebrow label above it
- **THEN** the two SHALL read as one grammatical sentence

#### Scenario: A tool is added or removed later

- **WHEN** the set of tools the app offers changes
- **THEN** the phrase set SHALL be the single place the headline's claims are edited, rather than the claims being restated in more than one location

### Requirement: Phrases are revealed and removed one character at a time

The headline SHALL reveal the active phrase by rendering a growing prefix of it, one character at a time, until the whole phrase is shown.

After the whole phrase has been shown, the headline SHALL hold it unchanged for a readable interval, then remove it by rendering a shrinking prefix, one character at a time, until no characters remain — at which point the next phrase begins revealing.

Removal SHALL be character-by-character from the end of the phrase; the phrase SHALL NOT be cleared in a single step, faded out, or replaced wholesale.

#### Scenario: A phrase types in

- **WHEN** a phrase becomes active
- **THEN** the rendered text SHALL grow from empty to the complete phrase, adding characters one at a time

#### Scenario: A phrase is held before it is removed

- **WHEN** a phrase has finished revealing
- **THEN** the complete phrase SHALL remain unchanged long enough to be read before any character is removed

#### Scenario: A phrase erases

- **WHEN** the hold interval elapses
- **THEN** the rendered text SHALL shrink from the complete phrase to empty, removing characters one at a time from the end

#### Scenario: Only whole characters are ever rendered

- **WHEN** the headline is observed at any moment during a reveal or removal
- **THEN** the rendered text SHALL be an exact prefix of the active phrase, never a partial character or a placeholder

### Requirement: Rotation is continuous and ordered

The headline SHALL advance to the next phrase in the set each time the active phrase finishes being removed, and SHALL return to the first phrase after the last one, cycling indefinitely for as long as the entry point is displayed.

The order of phrases SHALL be the order the phrase set declares, and SHALL be the same on every visit — the headline SHALL NOT shuffle or start at an arbitrary phrase.

#### Scenario: Advancing to the next phrase

- **WHEN** the active phrase has been fully removed
- **THEN** the next phrase in declaration order SHALL begin revealing

#### Scenario: Wrapping past the last phrase

- **WHEN** the last phrase in the set has been fully removed
- **THEN** the first phrase SHALL begin revealing again

#### Scenario: A fresh visit

- **WHEN** the entry point is loaded
- **THEN** the first phrase in declaration order SHALL be the one that reveals first

### Requirement: A visible insertion point marks where text is being typed

The headline SHALL display an insertion caret immediately after the last rendered character, so that the reveal and removal read as keyboard input.

The caret SHALL remain visible during reveal, hold, and removal alike, including at the moment when no characters are rendered, so the headline never appears to be simply empty.

The caret SHALL be decorative: it SHALL NOT be conveyed to assistive technology as text content of the headline.

#### Scenario: The caret follows the text

- **WHEN** characters are being revealed or removed
- **THEN** the caret SHALL be rendered immediately after the last rendered character

#### Scenario: The caret at an empty phrase boundary

- **WHEN** the active phrase has been fully removed and the next has not yet begun
- **THEN** the caret SHALL still be visible

#### Scenario: The caret is not read aloud

- **WHEN** the headline is read by assistive technology
- **THEN** the caret SHALL contribute no characters to what is announced

### Requirement: The user can stop the animation by pointing at it or focusing it

Because the headline updates itself automatically and runs for longer than five seconds alongside other page content, the system SHALL give the user a way to stop it.

The headline SHALL suspend its reveal, hold, and removal while the pointer is over it, or while keyboard focus is on or inside it, and SHALL resume from exactly where it suspended once the pointer leaves and focus moves away.

Suspending SHALL freeze the rendered text as-is rather than completing or clearing the active phrase.

#### Scenario: Pointing at the headline stops it

- **WHEN** the pointer moves over the headline mid-phrase
- **THEN** the rendered text SHALL stop changing and SHALL remain exactly as it was

#### Scenario: Focusing the headline stops it

- **WHEN** keyboard focus lands on or inside the headline mid-phrase
- **THEN** the rendered text SHALL stop changing

#### Scenario: Resuming

- **WHEN** the pointer leaves the headline and focus is no longer inside it
- **THEN** the headline SHALL continue from the character it stopped at, in the direction it was going

#### Scenario: Still paused while either condition holds

- **WHEN** the pointer leaves the headline but focus remains inside it
- **THEN** the headline SHALL remain suspended

### Requirement: The headline is still for users who prefer reduced motion

When the user's system indicates a preference for reduced motion, the headline SHALL render the first phrase in its entirety and SHALL NOT animate: no character-by-character reveal, no removal, no rotation to other phrases, and no caret.

The remaining phrases' subject matter SHALL remain discoverable elsewhere on the entry point, so a user who never sees the rotation is not deprived of knowing what the app does.

#### Scenario: Reduced motion is preferred

- **WHEN** the entry point is displayed and the user prefers reduced motion
- **THEN** the headline SHALL show the complete first phrase, unchanging, with no caret

#### Scenario: No timers run

- **WHEN** the user prefers reduced motion
- **THEN** the headline SHALL schedule no recurring work and SHALL never advance to another phrase

#### Scenario: The other tools remain described

- **WHEN** the headline is static because the user prefers reduced motion
- **THEN** each tool the app offers SHALL still be described in the entry point's own content

### Requirement: Assistive technology receives a stable headline, not a stream of keystrokes

The headline SHALL expose one complete, readable phrase to assistive technology at a time. Intermediate partially typed states SHALL NOT be announced.

The headline SHALL NOT be a live region: phrase changes SHALL NOT interrupt or queue announcements while the user is reading elsewhere on the page.

The entry point SHALL continue to expose exactly one top-level heading, whose accessible name is a complete phrase from the set, so that heading navigation is unaffected by the animation.

#### Scenario: Mid-reveal state is not announced

- **WHEN** a phrase is partway through being revealed
- **THEN** assistive technology SHALL NOT be given the partial text

#### Scenario: The heading has a complete accessible name

- **WHEN** the entry point's top-level heading is inspected
- **THEN** its accessible name SHALL be a complete phrase, never a truncated one

#### Scenario: Rotation does not interrupt the user

- **WHEN** the headline advances from one phrase to the next
- **THEN** no announcement SHALL be triggered by the change

### Requirement: The rotating headline does not shift the content beneath it

Because the phrases differ in length, the headline SHALL reserve stable vertical space so that content below it does not move as phrases reveal, wrap, or are removed.

#### Scenario: A shorter phrase follows a longer one

- **WHEN** a phrase that occupies fewer lines replaces one that occupied more
- **THEN** the content below the headline SHALL NOT change position

#### Scenario: Mid-reveal wrapping

- **WHEN** a phrase grows past the end of a line during its reveal
- **THEN** the content below the headline SHALL NOT change position

#### Scenario: Narrow viewports

- **WHEN** the entry point is displayed at a narrow viewport where phrases occupy more lines
- **THEN** the reserved space SHALL accommodate the longest phrase at that width, and content below SHALL remain still

### Requirement: A headline may animate one word inside a fixed sentence

A surface MAY hold part of its headline static and animate only the remainder, so that a fixed sentence keeps its shape while a single word cycles. The sign-in screen SHALL do this: it presents one sentence whose verb cycles through the tools the app offers, rather than replacing the whole line.

The static text SHALL never be revealed or erased — only the cycling portion SHALL animate. The insertion caret SHALL sit between the cycling portion and any static text that follows it, so the caret marks the point where characters are actually being typed rather than the end of the line.

Every requirement governing the whole-line headline — ordered indefinite rotation, hold before erasing, pause on pointer or focus, stillness under reduced motion, stable assistive-technology exposure, and reserved vertical space — SHALL apply unchanged to this shape.

#### Scenario: Only the cycling word animates

- **WHEN** the cycling word is being revealed or erased
- **THEN** the static text before and after it SHALL remain fully rendered and unchanged throughout

#### Scenario: The caret marks the typing position, not the line end

- **WHEN** static text follows the cycling word
- **THEN** the caret SHALL be rendered between the cycling word and that following text

#### Scenario: The sentence is still readable at the empty boundary

- **WHEN** the cycling word has been fully erased and the next has not begun
- **THEN** the surrounding static text SHALL still be present, and the caret SHALL still be visible between its two halves

#### Scenario: The accessible name is the whole sentence

- **WHEN** the heading is read by assistive technology at any point during the animation
- **THEN** its accessible name SHALL be the complete sentence — static text and the current whole word together — never the partially typed word

#### Scenario: Reduced motion shows the complete sentence

- **WHEN** the user prefers reduced motion
- **THEN** the heading SHALL render the complete sentence using the first word of the cycle, with no caret and no rotation
