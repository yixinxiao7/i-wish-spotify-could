from fastapi import APIRouter, HTTPException
from app.services.playlists_service import get_created_playlists, add_song_to_playlists
from app.services.token_service import get_valid_token
from app.services.pins_service import read_pins, set_pin, apply_pins
from app.models.schemas import SongPostData, PinPostData
import logging
import json
import os

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
def get_playlists():
    '''
    Get playlists
    Returns:
        dict: List of playlists, pinned playlists first
        {
            "playlists": list
            [
                {
                    "id": str,
                    "name": str,
                    "owner_id": str,
                    "playlist_image_url": str | None,
                    "pinned": bool
                }
            ]
        }
    '''
    token = get_valid_token()
    playlists = get_created_playlists(token)
    playlists = apply_pins(playlists, read_pins())
    return {"playlists": playlists}


@router.get("/pins")
def get_pins():
    '''
    Get pinned playlist IDs
    Returns:
        dict: Pinned playlist IDs
        {
            "pinnedIds": list[str]
        }
    '''
    return {"pinnedIds": list(read_pins())}


@router.post("/pin")
def post_pin(pin_post_data: PinPostData):
    '''
    Pin or unpin a playlist
    Args:
        pin_post_data (PinPostData): Playlist ID and desired pin state
    Returns:
        dict: Updated pinned playlist IDs
        {
            "pinnedIds": list[str]
        }
    '''
    pinned_ids = set_pin(pin_post_data.playlistId, pin_post_data.pinned)
    return {"pinnedIds": list(pinned_ids)}

@router.post("/add-song")
def post_song_to_playlists(song_post_data: SongPostData):
    '''
    Add song to playlists
    Args:
        request (Request): Request object containing the song and playlists
        access_token (str): Spotify access token
    Returns:
        dict: Success message
        {
            "message": str
        }
    '''
    song_id = song_post_data.songId
    playlist_ids = song_post_data.playlistIds
    token = get_valid_token()
    try:
        add_song_to_playlists(token, song_id, playlist_ids)

        # TODO: update cache of uncategorized songs to remove current song
        uncategorized_songs_path = 'all_uncategorized_songs.json'
        if os.path.exists(uncategorized_songs_path):
            with open(uncategorized_songs_path, 'r') as f:
                all_uncategorized_songs = json.loads(f.read())
            # Remove the song from the uncategorized songs list
            all_uncategorized_songs = [song for song in all_uncategorized_songs if song['id'] != song_id]
            with open(uncategorized_songs_path, 'w') as f:
                f.write(json.dumps(all_uncategorized_songs))

    except PermissionError as e:
        logger.warning("Permission denied adding song %s to playlists: %s", song_id, str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Failed to add song %s to playlists: %s", song_id, str(e))
        raise HTTPException(status_code=500, detail="Failed to add song to playlists")

    return {"message": "Song added to playlists successfully!"}
