import logging
from fastapi import APIRouter, HTTPException
from app.services.playback_services import toggle_playback, PlaybackError
from app.services.token_service import get_valid_token
from app.services.http_client import SpotifyRateLimitedError
from app.routers.playlists import RATE_LIMIT_DETAIL
from app.models.schemas import PlaybackModel

logger = logging.getLogger(__name__)
router = APIRouter()

SESSION_EXPIRED_DETAIL = "Your Spotify session expired. Log in again."
NO_DEVICE_DETAIL = "Open Spotify on a device, then try again."
PREMIUM_DETAIL = "Playback control requires Spotify Premium."
REFUSED_DETAIL = "Spotify refused to play this song on your device."
UPSTREAM_DETAIL = "Couldn't reach Spotify playback. Try again."


def _run(action: str, song_id: str) -> None:
    '''
    Run a playback command, mapping every failure to a real HTTP status.
    Returning a (body, status) tuple would be serialized as HTTP 200, and a
    bare 500 would reach the browser as a misleading CORS error.
    '''
    try:
        token = get_valid_token()
    except Exception as e:
        logger.warning("Could not get a valid token for playback: %s", str(e))
        raise HTTPException(status_code=401, detail=SESSION_EXPIRED_DETAIL)
    try:
        toggle_playback(token, action=action, song_id=song_id) # TODO: convert to enum
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited during playback %s: %s", action, str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except PlaybackError as e:
        logger.warning("Playback %s failed: %s", action, str(e))
        if e.reason in ("NO_DEVICE", "NO_ACTIVE_DEVICE"):
            raise HTTPException(status_code=409, detail=NO_DEVICE_DETAIL)
        if e.status == 403 and e.reason == "PREMIUM_REQUIRED":
            raise HTTPException(status_code=403, detail=PREMIUM_DETAIL)
        if e.status == 403 and action == "pause":
            return  # restriction on pause means already paused: end state holds
        if e.status == 403:
            raise HTTPException(status_code=403, detail=REFUSED_DETAIL)
        raise HTTPException(status_code=502, detail=UPSTREAM_DETAIL)
    except Exception as e:
        logger.error("Unexpected playback %s failure: %s", action, str(e))
        raise HTTPException(status_code=502, detail=UPSTREAM_DETAIL)


@router.put("/start")
def start_playback(playback_data: PlaybackModel):
    _run("play", playback_data.songId)
    return {"message": "Playback started successfully"}


@router.put("/stop")
def stop_playback(playback_data: PlaybackModel):
    _run("pause", playback_data.songId)
    return {"message": "Playback stopped successfully"}
