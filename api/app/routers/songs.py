from fastapi import APIRouter, Request, Header
from services.songs_service import *
from models.schemas import Pagination
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


@router.post("/")
def get_songs(pagination: Pagination):
    '''
    Get uncategorized songs
    Args:
        pagination (Pagination):
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
    offset = pagination.offset
    limit = pagination.limit
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    songs = get_uncategorized_songs(token, offset, limit)
    return {"songs": songs}
