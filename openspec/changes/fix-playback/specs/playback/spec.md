## Purpose

Lets the user preview a song from any song list by starting and stopping it on their own Spotify device, and tells them in plain language when that cannot happen. The app is a remote control; no audio plays in the browser.

## ADDED Requirements

### Requirement: Playback targets a device the user has open

When starting playback, the system SHALL direct the request to a specific device the user has Spotify open on, preferring the device Spotify reports as active, and SHALL NOT send a request that Spotify can accept without playing.

#### Scenario: An active device exists

- **WHEN** the user starts playback and Spotify reports an active, unrestricted device
- **THEN** the song SHALL play on that device

#### Scenario: Only idle devices exist

- **WHEN** the user starts playback and no device is active but at least one unrestricted device is available
- **THEN** the song SHALL play on an available unrestricted device

#### Scenario: Something else is already playing

- **WHEN** the user starts playback while another track is playing
- **THEN** the requested song SHALL replace it

#### Scenario: Session predates device targeting

- **WHEN** the current session was not granted permission to read the user's devices
- **THEN** the system SHALL still attempt playback without targeting a device, rather than failing outright

### Requirement: Playback failures are reported, never shown as success

A playback request that does not succeed SHALL be reported to the user as a failure, with a message that says what to do where one applies, and the play/pause control SHALL NOT change state.

#### Scenario: No device available

- **WHEN** the user starts playback and has no Spotify device available
- **THEN** the user SHALL be told to open Spotify on a device and try again
- **AND** the control SHALL remain in its "play" state

#### Scenario: Account cannot control playback

- **WHEN** Spotify refuses playback because the account lacks Premium
- **THEN** the user SHALL be told playback control requires Spotify Premium

#### Scenario: Session expired

- **WHEN** the stored session can no longer be refreshed
- **THEN** the user SHALL be told to log in again

#### Scenario: Rate limited

- **WHEN** Spotify rate-limits the playback request
- **THEN** the user SHALL see the app's standard rate-limit message

#### Scenario: Unexpected upstream failure

- **WHEN** Spotify fails for any other reason
- **THEN** the user SHALL be told playback could not be reached and to try again
- **AND** the browser SHALL receive a real error status, not a success status and not a response the browser reports as a cross-origin failure

### Requirement: Stopping is idempotent

Stopping playback when nothing is playing SHALL be treated as success, since the requested end state already holds.

#### Scenario: Pause when already paused

- **WHEN** the user stops playback and Spotify reports the player is already paused
- **THEN** the system SHALL report success and the control SHALL show "play"
