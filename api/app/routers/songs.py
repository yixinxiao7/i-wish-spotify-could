from fastapi import APIRouter, Request, Header
from services.songs_service import *
from models.schemas import Pagination
import json

router = APIRouter()

@router.get("/total")
def get_total_songs():
    # get token from token.json
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    total = get_total_uncategorized_songs()
    return {"total": total}


@router.post("/")
def get_songs(pagination: Pagination):
    # get token from token.json
    offset = pagination.offset
    limit = pagination.limit
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    songs = get_uncategorized_songs(token, offset, limit)
    return {"songs": songs}
