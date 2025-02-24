from fastapi import APIRouter, Request, Header
from services.songs_service import get_liked_songs
from models.schemas import Pagination
import json

router = APIRouter()

@router.post("/")
def get_songs(pagination: Pagination):
    # get token from token.json
    offset = pagination.offset
    limit = pagination.limit
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    all_songs = get_liked_songs(token, offset, limit)
    return {"songs": all_songs}

