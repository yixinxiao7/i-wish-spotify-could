from fastapi import APIRouter
from services.playlists_service import *
import json
import os

router = APIRouter()

@router.get("/")
def get_playlists():
    '''
    Get all playlists created by the current user
    Returns:
        dict: List of playlists
        {
            "playlists": list
            [
                {
                    "id": str,
                    "name": str,
                    "owner_id": str,
                    "description": str
                }
            ]
        }
    '''
    #TODO: add to cache

    # get token from token.json
    with open("token.json", "r") as f:
        access_token = json.loads(f.read())['access_token']

    # get created playlists
    playlists_path = 'playlists.json'
    if os.path.exists(playlists_path):
        with open(playlists_path, 'r') as f:
            playlists = json.loads(f.read())
    else:
        playlists = get_created_playlists(access_token)
        with open(playlists_path, 'w') as f:
            f.write(json.dumps(playlists))
    return {"playlists": playlists}
