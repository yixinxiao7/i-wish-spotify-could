from fastapi import APIRouter, Request, Header
from services.songs_service import get_all_liked_songs
import json

router = APIRouter()

@router.post("/")
def get_songs():
    # get token from token.json
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    all_songs = get_all_liked_songs(token)
    return {"songs": all_songs}

