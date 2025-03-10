from fastapi import APIRouter, Query
from services.songs_service import *
import json

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
def get_songs(offset: int = Query(0), limit: int = Query(10)):
    '''
    Get uncategorized songs
    Args:
        offset (int): Offset
        limit (int): Limit
    Returns:
        dict: List of uncategorized songs
        {
            "songs": list
            [
                {
                    "id": str,
                    "name": str,
                    "artists": str,
                    "album": str
                }
            ]
        }
    '''
    # get token from token.json
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    songs = get_uncategorized_songs(token, offset, limit)
    return {"songs": songs}
