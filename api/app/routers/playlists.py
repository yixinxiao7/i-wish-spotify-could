from fastapi import APIRouter, Request, Header
from app.services.playlists_service import *
from app.models.schemas import SongPostData
import json
import os

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
    with open("token.json", "r") as f:
        token = json.loads(f.read())['access_token']
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

    except Exception as e:
        # TODO: convert these to proper responses
        return {"message": str(e)}
    
    return {"message": "Song added to playlists successfully!"}