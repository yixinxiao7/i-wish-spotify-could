from fastapi import APIRouter, Request, Header
from app.services.playlists_service import *
import json

router = APIRouter()

@router.get("/")
def get_playlists():
    '''
    Get playlists
    Returns:
        dict: List of playlists
        {
            "playlists": list
            [
                {
                    "id": str,
                    "name": str,
                    "owner_id": str
                }
            ]
        }
    '''
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    playlists = get_created_playlists(token)
    return {"playlists": playlists}
