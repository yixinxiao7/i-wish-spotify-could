from fastapi import APIRouter
from app.services.playback_services import *
from app.models.schemas import PlaybackModel
import json


router = APIRouter()

@router.put("/start")
def start_playback(playback_data: PlaybackModel):
    song_id = playback_data.songId
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    try:
        toggle_playback(token, action="play", song_id=song_id) # TODO: convert to enum
        return {"message": "Playback started successfully"}
    except Exception as e:
        return {"message": f"Error starting playback: {str(e)}"}, 500


@router.put("/stop")
def stop_playback(playback_data: PlaybackModel):
    song_id = playback_data.songId
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
    try:
        toggle_playback(token, action="pause", song_id=song_id) # TODO: convert to enum
        return {"message": "Playback stopped successfully"}
    except Exception as e:
        return {"message": f"Error stopping playback: {str(e)}"}, 500