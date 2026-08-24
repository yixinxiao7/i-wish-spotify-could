## Purpose

Defines the single visual language every surface, control and accent in the app draws from: how an accent is applied, how a surface is built, what contrast a piece of text or a control boundary must reach, how large an interactive target must be, and how all of that holds in both light and dark themes. It exists so that a control's appearance is decided once and verified once, rather than re-invented per component and checked for text contrast only.

## ADDED Requirements

### Requirement: Accents are flat fills, never gradients

No interactive control, accent surface, or decorative element SHALL use a gradient fill. Every accent SHALL be a single flat color drawn from a theme token.

This applies to buttons of every variant and size, playback controls, progress indicators, and any surface that reads as an accent. A gradient SHALL NOT be reintroduced through an arbitrary-value utility, an inline style, or a background image.

#### Scenario: Primary action fill

- **WHEN** a primary action is rendered in either theme
- **THEN** its background SHALL be a single flat color from a theme token
- **AND** it SHALL NOT contain a gradient of any kind

#### Scenario: Secondary action fill

- **WHEN** a secondary action is rendered in either theme
- **THEN** its background SHALL be either a single flat color from a theme token or fully transparent
- **AND** it SHALL NOT contain a gradient of any kind

#### Scenario: No gradient anywhere in the rendered app

- **WHEN** any route of the app is rendered in either theme
- **THEN** no element's computed background image SHALL contain a gradient function

### Requirement: Text meets WCAG AA contrast against the surface behind it

Every piece of text SHALL reach at least 4.5:1 contrast against the surface actually rendered behind it, and at least 3:1 if it is large text as WCAG defines the term. This SHALL hold in both themes.

Text that conveys a current value SHALL NOT be styled as placeholder text. A control's displayed value is content, not a prompt, and is held to the same floor as any other text.

#### Scenario: Body and supporting copy

- **WHEN** any body, supporting, or muted text is rendered on a card or on the page background, in either theme
- **THEN** its contrast against that surface SHALL be at least 4.5:1

#### Scenario: A control's current value

- **WHEN** a select control displays its currently selected value
- **THEN** that value SHALL be rendered as content at a minimum of 4.5:1 against the surface behind it, not in the control's placeholder styling

#### Scenario: Text on an accent fill

- **WHEN** text is rendered on an accent-filled control
- **THEN** its contrast against that fill SHALL be at least 4.5:1

### Requirement: Interactive controls have a boundary the user can see

Every interactive control SHALL be visually distinguishable from the surface adjacent to it by at least 3:1, satisfying WCAG 1.4.11 for non-text contrast. This SHALL hold in both themes and on every surface the control is placed on — the page background, a card, a dialog, and the navigation bar.

A control whose fill does not reach 3:1 against its surroundings SHALL carry a border that does. A control SHALL NOT rely on a chevron, an icon, or its label alone to be identifiable as a control.

#### Scenario: Secondary button on a card

- **WHEN** a secondary button is rendered on a card in either theme
- **THEN** its visible boundary SHALL reach at least 3:1 against that card

#### Scenario: Secondary button on the navigation bar

- **WHEN** a secondary button is rendered in the navigation bar in either theme
- **THEN** its visible boundary SHALL reach at least 3:1 against the navigation surface

#### Scenario: Select control on the page background

- **WHEN** a select control is rendered on the page background in either theme
- **THEN** its visible boundary SHALL reach at least 3:1 against that background

#### Scenario: Accent-filled control whose fill is low contrast

- **WHEN** an accent-filled control's fill is below 3:1 against the surface behind it
- **THEN** the control SHALL carry a border that reaches at least 3:1 against that surface

### Requirement: Destructive actions are visually distinct from neutral ones

A control whose activation removes user data SHALL be visually distinguishable from neutral secondary controls. It SHALL NOT reuse the neutral secondary treatment.

#### Scenario: Removing a song from a playlist

- **WHEN** the control that removes a song from a playlist is rendered
- **THEN** it SHALL carry a treatment distinct from neutral secondary controls in the same view
- **AND** that treatment SHALL meet the boundary contrast floor for interactive controls

### Requirement: A control's shape is decided by its variant, not its size

Two controls of the same variant SHALL render with the same shape regardless of what size they are rendered at. Choosing a size SHALL NOT change a control's corner treatment.

#### Scenario: Same variant at two sizes

- **WHEN** two controls of the same variant are rendered at different sizes
- **THEN** they SHALL have the same corner radius treatment

#### Scenario: The app's primary action

- **WHEN** the control that files a song into playlists is rendered
- **THEN** its shape SHALL match every other control of the same variant elsewhere in the app

### Requirement: Surfaces are flat and opaque

A card, dialog, or panel SHALL be rendered as a flat opaque surface drawn from a theme token. Backdrop blur SHALL NOT be applied to repeated list content.

Decoration SHALL NOT be applied uniformly across surfaces that serve different roles: a page-level container and a list row SHALL be visually distinguishable from one another.

#### Scenario: A song row

- **WHEN** a song row is rendered in either theme
- **THEN** its background SHALL be an opaque token color
- **AND** it SHALL NOT apply a backdrop filter

#### Scenario: A long list of rows

- **WHEN** a page renders many song rows at once
- **THEN** no row SHALL introduce a backdrop-filter compositing region

#### Scenario: Container versus row

- **WHEN** a page-level container and a list row are rendered in the same view
- **THEN** they SHALL be distinguishable from each other by surface treatment

### Requirement: Neutral tokens share the brand's hue family

The neutral tokens the app inherits from its component library — muted foreground, border, input, ring, and the footer surface — SHALL be tinted toward the same hue family as the brand tokens.

A neutral SHALL NOT sit on a different temperature from the surface it is drawn on. This is what makes a muted grey read as washed out on a colored ground.

#### Scenario: Muted text on the page background

- **WHEN** muted text is rendered on the page background in either theme
- **THEN** its hue SHALL belong to the same family as the page background
- **AND** its contrast SHALL be at least 4.5:1

#### Scenario: The footer band in dark theme

- **WHEN** the footer is rendered in the dark theme
- **THEN** its hue SHALL belong to the same family as the page background above it, with no visible temperature seam at the boundary

### Requirement: Interactive targets are large enough to hit

Every interactive target SHALL be at least 44 by 44 CSS pixels, measured as the region that responds to a pointer or touch, not as the region that is painted.

Where a control is visually smaller than that, its responsive region SHALL be enlarged without changing its painted size, and that enlarged region SHALL NOT be clipped by an ancestor.

#### Scenario: A visually small control

- **WHEN** a control is painted smaller than 44 by 44 pixels
- **THEN** its responsive region SHALL still measure at least 44 by 44 pixels

#### Scenario: An enlarged region inside a clipping ancestor

- **WHEN** a control's responsive region is enlarged beyond its painted bounds
- **THEN** no ancestor SHALL clip that region below 44 by 44 pixels

#### Scenario: A row that navigates

- **WHEN** a list row acts as a navigation target
- **THEN** the responsive region SHALL span the full row, not only its text
- **AND** the row SHALL present a hover state indicating it is interactive

### Requirement: Keyboard focus is always visible

Every focusable control SHALL present a focus indicator visible against the surface it sits on, in both themes, when focus arrives from the keyboard.

#### Scenario: Keyboard traversal of a page

- **WHEN** a user moves focus through a page with the keyboard
- **THEN** every focused control SHALL present a visible focus indicator
- **AND** that indicator SHALL be distinguishable from the surface behind it

### Requirement: Both themes are held to the same standard

Every requirement in this capability SHALL hold in the light theme and in the dark theme. A token SHALL NOT be defined for one theme only.

#### Scenario: A token defined for one theme

- **WHEN** a color token is defined
- **THEN** it SHALL have a definition in both the light and dark theme blocks

#### Scenario: Switching themes

- **WHEN** the user switches themes
- **THEN** every contrast floor in this capability SHALL still be met
