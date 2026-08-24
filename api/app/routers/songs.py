import logging

from fastapi import APIRouter, HTTPException, Query
from app.services.songs_service import get_uncategorized_songs, get_total_uncategorized_songs, force_rebuild
from app.services.token_service import get_valid_token
from app.services.http_client import SpotifyRateLimitedError

logger = logging.getLogger(__name__)
router = APIRouter()

RATE_LIMIT_DETAIL = (
    "Spotify is rate limiting this app right now. This usually clears on its "
    "own within an hour — please try again later."
)

@router.get("/total")
def get_total_songs():
    '''
    Get total number of uncategorized songs
    Returns:
        dict: Total number of uncategorized songs
        {
            "total": int
        }
    '''
    try:
        return {"total": get_total_uncategorized_songs()}
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited getting uncategorized total: %s", str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except Exception as e:
        logger.error("Failed to get uncategorized songs total: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to load the song count.")


@router.get("/")
def get_songs(
    offset: int = Query(0, ge=0, description="Offset"),
    limit: int = Query(10, ge=1, le=100, description="Limit")
):
    '''
    Get uncategorized songs
    Args:
        offset (int): Offset (>= 0)
        limit (int): Limit (1-100)
    Returns:
        dict: List of uncategorized songs
        {
            "songs": list
            [
                {
                    "id": str,
                    "name": str,
                    "artist": str,
                    "album": str
                }
            ]
        }
    '''
    token = get_valid_token()
    try:
        songs = get_uncategorized_songs(token, offset, limit)
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited loading uncategorized songs: %s", str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except Exception as e:
        # An unhandled exception here returns a bare 500 with no CORS
        # headers, which the browser reports as a CORS violation — and the
        # frontend's catch-all then renders "no uncategorized songs found",
        # telling the user their library is empty when the real cause is a
        # failed load.
        logger.error("Failed to load uncategorized songs: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to load songs.")
    return {"songs": songs}


@router.post("/refresh")
def post_refresh_songs():
    '''
    Force the uncategorized-songs index to rebuild from Spotify now,
    ignoring the freshness window — used when the user wants to pick up a
    change made directly in Spotify without logging out.
    Returns:
        dict: Total number of uncategorized songs after the rebuild
        {
            "total": int
        }
    '''
    token = get_valid_token()
    try:
        total = force_rebuild(token)
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited refreshing uncategorized songs index: %s", str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except Exception as e:
        logger.error("Failed to refresh uncategorized songs index: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to refresh uncategorized songs.")
    return {"total": total}
