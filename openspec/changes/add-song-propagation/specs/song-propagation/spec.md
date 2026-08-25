## Purpose

Lets the user build one of their playlists out of another one: choose a destination playlist and a source playlist they own, see only the source's songs the destination is missing, and add any of them to the destination one at a time. It exists because closely related playlists share most of their material, and the app otherwise offers no way to move a song that is already filed somewhere into a second playlist.

## ADDED Requirements

### Requirement: Propagation is reachable from the app's entry point

The app's entry point SHALL offer propagation as an action alongside its other tools, described in terms of what it does for the user.

#### Scenario: Entry point lists the action

- **WHEN** the user views the app's entry point
- **THEN** an action that starts the propagation flow SHALL be presented alongside the existing tools

#### Scenario: Starting the flow

- **WHEN** the user activates that action
- **THEN** the system SHALL present the destination chooser

### Requirement: Choosing the destination playlist

The system SHALL present the playlists the user owns and let the user choose one as the destination — the playlist songs will be added to.

The destination chooser SHALL present playlists through the same shared playlist presentation the rest of the app uses, so it carries pinned-first ordering, pin toggles, filtering, and full-row targets without restating them.

Playlists the user does not own SHALL NOT be offered, since the user cannot add songs to them.

#### Scenario: Owned playlists are offered

- **WHEN** the user opens the destination chooser
- **THEN** every playlist the user owns SHALL be presented as a choosable destination

#### Scenario: Playlists the user does not own

- **WHEN** the user's library contains playlists owned by someone else
- **THEN** those playlists SHALL NOT appear in the destination chooser

#### Scenario: The playlist list cannot be loaded

- **WHEN** the playlists cannot be loaded
- **THEN** the system SHALL report the reason the server gave and offer the user a way to retry

#### Scenario: The user owns no playlists

- **WHEN** the user owns no playlists
- **THEN** the system SHALL say so rather than presenting an empty chooser

### Requirement: Choosing the source playlist

After a destination is chosen, the system SHALL ask the user to choose the source playlist — the playlist songs are drawn from — before showing any songs.

The source chooser SHALL offer only playlists the user owns, and SHALL NOT offer the chosen destination.

The user SHALL be able to abandon the choice and return to the destination chooser without a source being selected for them.

#### Scenario: Source options exclude the destination

- **WHEN** the user has chosen a destination and is asked for a source
- **THEN** every owned playlist except the chosen destination SHALL be offered

#### Scenario: Only one owned playlist exists

- **WHEN** the user owns exactly one playlist and chooses it as the destination
- **THEN** the system SHALL state that there is no other playlist to draw from rather than presenting an empty source list

#### Scenario: Abandoning the source choice

- **WHEN** the user dismisses the source chooser without choosing
- **THEN** no source SHALL be selected and the user SHALL remain in the destination chooser

#### Scenario: Both playlists chosen

- **WHEN** the user chooses a source
- **THEN** the system SHALL present the propagation song list for that destination and source pair

### Requirement: Only songs the destination is missing are presented

The propagation song list SHALL present the songs of the source playlist that the destination playlist does not already contain, and SHALL NOT present songs the destination already contains.

The exclusion SHALL be applied to the source playlist as a whole before the list is divided into pages, so the reported number of songs and the number of pages both reflect only the songs actually presented.

#### Scenario: Overlapping songs are omitted

- **WHEN** a song is in both the source and the destination playlist
- **THEN** that song SHALL NOT appear in the propagation song list

#### Scenario: Reported total reflects the exclusion

- **WHEN** the source playlist has 100 songs and the destination already contains 40 of them
- **THEN** the system SHALL report 60 songs and SHALL page through exactly those 60

#### Scenario: Every source song is already present

- **WHEN** the destination already contains every song in the source playlist
- **THEN** the system SHALL state that there is nothing left to propagate, distinctly from the message shown for a source playlist that has no songs at all

#### Scenario: The source playlist is empty

- **WHEN** the source playlist contains no songs
- **THEN** the system SHALL state that the source playlist is empty

### Requirement: The propagation song list behaves like the app's other song list

The propagation song list SHALL present each song with the same information and playback control as the app's other paginated song list, and SHALL offer the same ordering options, the same page-size options, and the same paging controls, with the same behavior.

Ordering SHALL be computed over the whole list of presented songs, not over the current page.

Where an ordering option is unavailable, the system SHALL communicate that using the reason it observed, exactly as the app's other song list does.

#### Scenario: Ordering options

- **WHEN** the user opens the ordering control on the propagation song list
- **THEN** the same ordering options offered by the app's other paginated song list SHALL be available

#### Scenario: Ordering spans the whole list

- **WHEN** the user changes the ordering
- **THEN** the new order SHALL be computed across every presented song and the user SHALL be returned to the first page

#### Scenario: Changing page size

- **WHEN** the user changes how many songs a page holds
- **THEN** the user SHALL be returned to the first page of the re-divided list

#### Scenario: An ordering option is unavailable

- **WHEN** an ordering option cannot be offered
- **THEN** that option SHALL be disabled and the reason the system observed SHALL be stated

### Requirement: Adding a song to the destination

Each presented song SHALL offer a single control that adds that song to the chosen destination playlist. The control SHALL be labelled so that assistive technology conveys which song it acts on, and SHALL be operable by keyboard.

Adding SHALL act on exactly one song. The system SHALL NOT require or offer a multi-song selection step.

#### Scenario: Adding a song

- **WHEN** the user activates a song's add control
- **THEN** the system SHALL add that song to the destination playlist

#### Scenario: The control identifies its song

- **WHEN** assistive technology reads a song's add control
- **THEN** the control's accessible name SHALL identify the song it adds

#### Scenario: Keyboard operation

- **WHEN** the user moves focus to a song's add control and activates it with the keyboard
- **THEN** the song SHALL be added exactly as it would on click

### Requirement: Adding a song is reversible

An add SHALL be deferred for a window during which the user can take it back, and SHALL NOT be carried out until that window elapses.

The song SHALL leave the presented list as soon as the user asks for the add, and the system SHALL offer a way to reverse it for the whole window. Reversing SHALL return the song to the list and SHALL result in no request being made.

The window SHALL pause while the user is hovering or focused within the affordance offering the reversal, and SHALL resume when they leave it.

#### Scenario: The window elapses

- **WHEN** the window elapses without the user reversing
- **THEN** the song SHALL be added to the destination playlist

#### Scenario: The user reverses

- **WHEN** the user reverses the add before the window elapses
- **THEN** the song SHALL NOT be added, and it SHALL return to the presented list

#### Scenario: The user is reaching for the reversal control

- **WHEN** the pointer is over the reversal affordance, or keyboard focus is within it
- **THEN** the window SHALL be paused and the affordance SHALL remain available

#### Scenario: Several adds pending at once

- **WHEN** the user asks to add more than one song before the first window elapses
- **THEN** each song SHALL have its own independent window and its own reversal, and reversing one SHALL NOT affect the others

### Requirement: A pending add is not lost when the user leaves

An add the user has asked for and not reversed SHALL be carried out even if the user leaves the page before its window elapses, whether they navigate elsewhere in the app or close the page.

A paused window SHALL be treated the same way: pausing delays the add, it does not cancel it.

#### Scenario: Navigating away within the app

- **WHEN** the user leaves the propagation song list while an add is pending
- **THEN** that add SHALL be carried out rather than dropped

#### Scenario: Closing or reloading the page

- **WHEN** the page is closed or reloaded while an add is pending
- **THEN** the system SHALL attempt to carry the add out rather than dropping it

### Requirement: A failed add is reported and reverted in the interface

Where an add fails, the system SHALL return the song to the presented list and SHALL tell the user it was not added, naming the song.

Where the failure is that the app is not permitted to modify the destination playlist, the message SHALL say the playlist could not be modified rather than inviting an immediate retry.

#### Scenario: The add fails

- **WHEN** an add request fails
- **THEN** the song SHALL reappear in the list and the user SHALL be told it was not added

#### Scenario: Permission denied

- **WHEN** the add fails because the destination playlist cannot be modified
- **THEN** the message SHALL state that the playlist could not be modified

#### Scenario: The service is rate limited

- **WHEN** the add fails because the upstream service is rate limiting the app
- **THEN** the message shown SHALL be the one the server gave for that condition

### Requirement: No second destination picker on the propagation song list

Because the destination is already chosen, the propagation song list SHALL NOT offer the general "add this song to playlists" control that the app's other song lists offer.

#### Scenario: The song rows

- **WHEN** the user views a song on the propagation song list
- **THEN** no control for choosing arbitrary playlists to file the song into SHALL be present

#### Scenario: Other song lists are unaffected

- **WHEN** the user views a song on any other song list in the app
- **THEN** that list's existing controls SHALL be unchanged

### Requirement: Both playlists must be owned by the current user

The system SHALL serve the propagation song list only when both the destination and the source are playlists the current user owns. If either is unknown or not owned, the system SHALL report it as unavailable rather than presenting songs or attempting a write.

#### Scenario: Unknown destination

- **WHEN** the propagation song list is requested for a destination that does not exist or is not owned by the user
- **THEN** the system SHALL report the pair as unavailable and SHALL NOT present any songs

#### Scenario: Unknown source

- **WHEN** the propagation song list is requested for a source that does not exist or is not owned by the user
- **THEN** the system SHALL report the pair as unavailable and SHALL NOT present any songs

#### Scenario: A transient failure is not reported as a missing playlist

- **WHEN** the playlists cannot be checked because the request to the upstream service failed or was rate limited
- **THEN** the system SHALL report a load failure with the observed reason, and SHALL NOT report the playlist as missing

### Requirement: Excluding a playlist's songs is an opt-in extension of the existing song listing

The existing endpoint that serves one page of a playlist's songs SHALL accept an optional identifier of a playlist whose songs are to be excluded, and SHALL behave exactly as it does today when that identifier is absent.

When the identifier is present, the response SHALL omit songs the named playlist contains and SHALL report the total after that exclusion.

#### Scenario: Parameter absent

- **WHEN** a client requests a page of a playlist's songs without naming a playlist to exclude
- **THEN** the response SHALL be identical to today's — every song in the playlist, ordered and paged as requested

#### Scenario: Parameter present

- **WHEN** a client requests a page of a playlist's songs and names a playlist to exclude
- **THEN** songs contained by the named playlist SHALL be omitted from the page and from the reported total

#### Scenario: Excluded playlist is not owned by the user

- **WHEN** the named playlist to exclude does not exist or is not owned by the current user
- **THEN** the system SHALL reject the request the same way it rejects an unknown path playlist, and SHALL NOT return songs

#### Scenario: Excluded playlist is the same as the requested playlist

- **WHEN** the named playlist to exclude is the playlist being listed
- **THEN** the system SHALL reject the request as invalid rather than returning an empty list
