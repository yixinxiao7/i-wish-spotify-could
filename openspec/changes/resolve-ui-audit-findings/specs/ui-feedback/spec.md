## Purpose

Defines what the app communicates to the user and how: which changes are announced to assistive technology and at what urgency, what structure a screen reader can navigate, how long a reversible action stays reversible, and whether a status message reflects the cause the system actually observed. It exists because an announcement that fires too often, at the wrong urgency, or with a guessed cause is worse than none.

## ADDED Requirements

### Requirement: Announcements are scoped to what changed

A live region SHALL wrap only the content whose change is worth announcing. A collection of items SHALL NOT be wrapped in a live region on the grounds that individual items may change.

#### Scenario: A page of songs is re-ordered

- **WHEN** the user changes the sort order of a song list
- **THEN** the individual song entries SHALL NOT be re-announced

#### Scenario: The user moves to another page

- **WHEN** the user pages through a song list
- **THEN** the individual song entries SHALL NOT be re-announced

#### Scenario: A song is removed

- **WHEN** the user removes a song from a playlist
- **THEN** the removal SHALL be announced once
- **AND** the remaining songs on the page SHALL NOT be re-announced

### Requirement: Errors are announced at error urgency

A message reporting a failure SHALL be conveyed to assistive technology at an urgency that interrupts, distinct from the urgency used for routine status. A failure SHALL NOT be queued behind unrelated speech.

#### Scenario: An action fails

- **WHEN** an action fails and a message reports the failure
- **THEN** that message SHALL be conveyed at an urgency that interrupts current speech

#### Scenario: An action succeeds

- **WHEN** an action succeeds and a message reports it
- **THEN** that message SHALL be conveyed at routine status urgency

#### Scenario: A second message arrives while one is showing

- **WHEN** a second message appears while an earlier one is still shown
- **THEN** only the new message SHALL be announced
- **AND** the earlier message SHALL NOT be re-announced

### Requirement: A dialog's description describes the dialog

A dialog's accessible description SHALL be a description of the dialog. Content the user is meant to work through SHALL NOT serve as the dialog's description.

Where a dialog has nothing to describe beyond its title, it SHALL have no description rather than borrowing one from its content.

#### Scenario: Opening a dialog containing a list

- **WHEN** the user opens a dialog whose body is a list of choices
- **THEN** the list SHALL NOT be announced as the dialog's description

#### Scenario: A dialog with no description

- **WHEN** a dialog has no description beyond its title
- **THEN** it SHALL declare no accessible description

### Requirement: A list of items is structured as a list

Content that is a list of items SHALL be exposed as a list, and each item's primary label SHALL be exposed as a heading, so that a screen-reader user can navigate by list item and by heading.

#### Scenario: The song list

- **WHEN** a page presents a list of songs
- **THEN** the songs SHALL be exposed as a list with a countable number of items
- **AND** each song's title SHALL be exposed as a heading

#### Scenario: Heading order

- **WHEN** song titles are exposed as headings
- **THEN** their level SHALL sit below the page's own heading without skipping a level

### Requirement: A reversible action stays reversible long enough to reverse

Where the system defers a destructive action so the user can take it back, the window in which the action can be reversed SHALL be long enough to find and activate the control that reverses it, including by keyboard and with a screen reader.

The window SHALL pause while the user is hovering or focused within the control that offers the reversal, and SHALL NOT expire while the user is interacting with it. The affordance offering the reversal SHALL remain available for the whole window.

#### Scenario: The user hovers the reversal affordance

- **WHEN** the pointer is over the affordance offering the reversal
- **THEN** the window SHALL be paused and the affordance SHALL remain visible

#### Scenario: The user focuses the reversal control

- **WHEN** keyboard focus is within the affordance offering the reversal
- **THEN** the window SHALL be paused and the affordance SHALL remain visible

#### Scenario: The user leaves the affordance

- **WHEN** the pointer leaves the affordance and focus is elsewhere
- **THEN** the window SHALL resume

#### Scenario: Reversal after the window resumes

- **WHEN** the user activates the reversal control at any point before the window elapses
- **THEN** the destructive action SHALL NOT be carried out

#### Scenario: The window elapses

- **WHEN** the window elapses without the user reversing
- **THEN** the destructive action SHALL be carried out

### Requirement: Status messages report the cause the system observed

Where the system knows why a capability is unavailable, the message shown SHALL reflect that cause. A message SHALL NOT assert a single cause, or instruct the user to take a corrective step, unless the system has established that cause applies.

#### Scenario: Cause reported by the server

- **WHEN** the server reports why a capability is unavailable
- **THEN** the message shown SHALL reflect the reported cause

#### Scenario: A corrective instruction

- **WHEN** a message instructs the user to take a corrective step
- **THEN** that instruction SHALL be shown only for the causes that step actually resolves

#### Scenario: Cause not established

- **WHEN** a capability is unavailable and the cause is not established
- **THEN** the message SHALL state that it is unavailable without instructing the user to take a step that may not apply

### Requirement: Transient states are presented in the app's own language

A state the app shows while it works — redirecting, loading, resolving a session — SHALL be presented using the app's own surfaces, typography, and theme.

#### Scenario: Redirecting an expired session

- **WHEN** the app determines a session has expired and redirects the user
- **THEN** the state shown SHALL use the app's themed surface and typography
- **AND** it SHALL honor the user's current theme

### Requirement: Finding a destination does not require reading the whole list

Where the user chooses from a collection that grows with their library, the interface SHALL provide a way to narrow that collection rather than requiring the user to scan all of it.

#### Scenario: Choosing playlists to file a song into

- **WHEN** the user opens the control for filing a song into playlists
- **THEN** a means of narrowing the list of playlists SHALL be available

#### Scenario: Narrowing the list

- **WHEN** the user enters text to narrow the list of playlists
- **THEN** only playlists matching that text SHALL be presented
- **AND** playlists already selected SHALL remain selected

### Requirement: Information the user can already see is not repeated

A field SHALL NOT be presented when its value duplicates another field already shown for the same item.

#### Scenario: Album matches the track title

- **WHEN** a song's album name is the same as its track title
- **THEN** the album SHALL NOT be shown

#### Scenario: Album matches the artist

- **WHEN** a song's album name is the same as its artist
- **THEN** the album SHALL NOT be shown
