from fastapi import APIRouter, Query
from app.services.songs_service import *
from app.models.schemas import Pagination
import json
from fastapi import Query

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
    offset: int = Query(0, description="Offset"),
    limit: int = Query(10, description="Limit")
):
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
                    "artist": str,
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
