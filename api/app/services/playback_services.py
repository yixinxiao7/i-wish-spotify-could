import logging
from app.services.http_client import spotify_get, spotify_put
from app.services.token_service import get_granted_scopes

logger = logging.getLogger(__name__)

PLAYER_URL = "https://api.spotify.com/v1/me/player"
REQUIRED_SCOPE = "user-read-playback-state"


class PlaybackError(Exception):
    '''
    Raised when Spotify refuses or fails a playback command, or when there is
    no device to send one to. Carries Spotify's status and `reason` (e.g.
    NO_ACTIVE_DEVICE, PREMIUM_REQUIRED) so the router can map it to a real
    HTTP status instead of the caller parsing a message string.
    '''

    def __init__(self, status: int, reason: str = None, message: str = ""):
        self.status = status
        self.reason = reason
        self.message = message
        super().__init__(f"Playback error {status} ({reason}): {message}")

    @classmethod
    def from_response(cls, response) -> "PlaybackError":
        '''Build from a Spotify error response, tolerating a non-JSON or empty body.'''
        reason = None
        message = ""
        try:
            error = response.json().get("error")
            if isinstance(error, dict):
                reason = error.get("reason")
                message = error.get("message") or ""
            elif error:
                message = str(error)
        except Exception:
            pass
        return cls(response.status_code, reason, message)


def _resolve_device_id(access_token: str) -> str:
    '''
    Pick the device to play on: the active, unrestricted one, else the first
    unrestricted one. Raises PlaybackError(reason="NO_DEVICE") when there is none.
    '''
    headers = {"Authorization": f"Bearer {access_token}"}
    response = spotify_get(f"{PLAYER_URL}/devices", headers=headers)
    if response.status_code != 200:
        raise PlaybackError.from_response(response)
    devices = [d for d in response.json().get("devices", []) if not d.get("is_restricted")]
    for device in devices:
        if device.get("is_active"):
            return device["id"]
    if devices:
        return devices[0]["id"]
    raise PlaybackError(404, "NO_DEVICE", "No available Spotify device.")


def toggle_playback(access_token: str, action: str, song_id: str) -> None:
    '''
    Toggle playback state on Spotify
    Args:
        access_token (str): Spotify access token
        action (str): "play" to start playback, "pause" to stop playback
    Raises:
        PlaybackError: Spotify refused the command, or no device was available
        SpotifyRateLimitedError: Spotify rate limited the request
    '''
    headers = {"Authorization": f"Bearer {access_token}"}
    kwargs = {"headers": headers}
    if action == "play":
        kwargs["json"] = {"uris": [f"spotify:track:{song_id}"]}
        # Without a device_id Spotify can answer 204 and play nothing. Tokens
        # granted before the scope existed fall back to the untargeted request.
        if REQUIRED_SCOPE in get_granted_scopes():
            kwargs["params"] = {"device_id": _resolve_device_id(access_token)}
    response = spotify_put(f"{PLAYER_URL}/{action}", **kwargs)
    if not 200 <= response.status_code < 300:
        raise PlaybackError.from_response(response)


__all__ = ["toggle_playback", "PlaybackError"]
