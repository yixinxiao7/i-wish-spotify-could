from fastapi import APIRouter
from app.services.playback_services import toggle_playback
from app.services.token_service import get_valid_token
from app.models.schemas import PlaybackModel


router = APIRouter()

@router.put("/start")
def start_playback(playback_data: PlaybackModel):
    song_id = playback_data.songId
    token = get_valid_token()
    try:
        toggle_playback(token, action="play", song_id=song_id) # TODO: convert to enum
        return {"message": "Playback started successfully"}
    except Exception as e:
        return {"message": f"Error starting playback: {str(e)}"}, 500


@router.put("/stop")
def stop_playback(playback_data: PlaybackModel):
    song_id = playback_data.songId
    token = get_valid_token()
    try:
        toggle_playback(token, action="pause", song_id=song_id) # TODO: convert to enum
        return {"message": "Playback stopped successfully"}
    except Exception as e:
        return {"message": f"Error stopping playback: {str(e)}"}, 500
