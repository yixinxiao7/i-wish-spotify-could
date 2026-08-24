## Purpose

Defines how the user moves through a long list of songs — the paging controls, what they claim about position, what happens when the page size changes, and what stands in for content while it loads. Both the uncategorized-songs list and the playlist-cleanup list are paged the same way, so this capability describes the behavior once for both.

## ADDED Requirements

### Requirement: Paging controls fit the viewport

The paging controls SHALL fit within the viewport at every supported width down to 320 CSS pixels, without requiring the user to scroll the page horizontally, satisfying WCAG 1.4.10.

Where the full set of numbered controls cannot fit, the interface SHALL adapt to a form that does — it SHALL NOT shrink the controls below the minimum target size, hide the controls that advance the page, or allow the page to scroll sideways.

#### Scenario: Narrow viewport on a middle page

- **WHEN** the list is on a middle page at a viewport width of 320 pixels
- **THEN** the document SHALL NOT scroll horizontally
- **AND** the controls for the previous and next page SHALL both be within the viewport

#### Scenario: Handset width

- **WHEN** the list is on any page at a viewport width of 375 pixels
- **THEN** the document SHALL NOT scroll horizontally
- **AND** the controls for the previous and next page SHALL both be within the viewport

#### Scenario: The user's position is still legible when numbers are dropped

- **WHEN** the viewport is too narrow to show the numbered page controls
- **THEN** the interface SHALL still convey the current page and the total number of pages

#### Scenario: Wide viewport

- **WHEN** the viewport is wide enough for the full numbered control set
- **THEN** the numbered controls SHALL be presented

### Requirement: The position indicator tells the truth

A marker indicating that pages have been skipped SHALL appear only where pages are in fact skipped. The numbered controls SHALL be a truthful account of which pages are reachable directly and which are elided.

#### Scenario: No pages elided between two numbers

- **WHEN** two adjacent numbered controls represent consecutive pages
- **THEN** no skipped-pages marker SHALL be shown between them

#### Scenario: Pages elided between two numbers

- **WHEN** two adjacent numbered controls represent pages that are not consecutive
- **THEN** a skipped-pages marker SHALL be shown between them

#### Scenario: Near the start of a long list

- **WHEN** the user is on the third page of a long list
- **THEN** no skipped-pages marker SHALL appear between the first page control and the second

### Requirement: Changing the page size returns the user to a coherent position

When the user changes how many items a page holds, the system SHALL place them at a position consistent with the new page size and SHALL report that position accurately.

The reported current page, the reported total number of pages, and the items actually shown SHALL agree with one another after the change.

#### Scenario: Page size changed from a later page

- **WHEN** the user is on a later page and changes the page size
- **THEN** the items shown, the reported current page, and the reported total pages SHALL be mutually consistent

#### Scenario: Paging after a page-size change

- **WHEN** the user changes the page size and then advances to the next page
- **THEN** the items shown SHALL be the ones that follow those on the previous page

#### Scenario: Both lists behave the same way

- **WHEN** the page size is changed on either the uncategorized-songs list or the playlist-cleanup list
- **THEN** both SHALL apply the same rule for where the user lands

### Requirement: Loading placeholders match the content they stand in for

A placeholder shown while list content loads SHALL occupy the same dimensions as the content that replaces it, so that content arriving does not shift the layout.

#### Scenario: Placeholder replaced by content

- **WHEN** a loading placeholder for a song row is replaced by the loaded row
- **THEN** the width and height of the region SHALL be unchanged

#### Scenario: Placeholder at a wide viewport

- **WHEN** loading placeholders are shown at a viewport wide enough for the list to be constrained
- **THEN** each placeholder SHALL be constrained to the same width as a loaded row

#### Scenario: Both lists use the same placeholder

- **WHEN** either paged song list is loading
- **THEN** the placeholder shown SHALL be the same one, matching that list's row dimensions

### Requirement: Artwork for visible rows loads without deferral

Images for rows that are within the viewport when the list first renders SHALL be requested immediately. Deferred loading SHALL apply only to rows below the fold.

#### Scenario: Rows visible on first render

- **WHEN** a song list first renders
- **THEN** artwork for the rows already within the viewport SHALL be requested without deferral

#### Scenario: Rows below the fold

- **WHEN** a song list contains rows below the viewport
- **THEN** artwork for those rows SHALL be deferred until they approach the viewport
