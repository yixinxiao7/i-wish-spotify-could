from fastapi import APIRouter, Query
from app.services.songs_service import get_uncategorized_songs, get_total_uncategorized_songs
from app.services.token_service import get_valid_token

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
