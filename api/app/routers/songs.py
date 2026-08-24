import logging

from fastapi import APIRouter, HTTPException, Query
from app.services.songs_service import get_uncategorized_songs, get_total_uncategorized_songs, force_rebuild
from app.services.token_service import get_valid_token

logger = logging.getLogger(__name__)
router = APIRouter()

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
    return {"total": get_total_uncategorized_songs()}


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
    songs = get_uncategorized_songs(token, offset, limit)
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
    except Exception as e:
        logger.error("Failed to refresh uncategorized songs index: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to refresh uncategorized songs.")
    return {"total": total}
