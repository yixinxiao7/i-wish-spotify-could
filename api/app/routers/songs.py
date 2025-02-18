from fastapi import APIRouter, Request, Header
from services.songs_service import get_all_liked_songs


router = APIRouter()

@router.post("/")
def get_songs():
    # get token from token.json
    with open("token.json", "r") as f:
        token = f.read()
    all_songs = get_all_liked_songs(token)
    # all_songs = [{ "name": "ana", "artist": "ana", "album": "ana", "url": "ana" }]
    return {"songs": all_songs}

