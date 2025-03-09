import requests
import os
import json
from services.users_services import *

def get_created_playlists(access_token: str):
    '''
    Get all playlists created by the current user
    Args:
        access_token (str): Spotify access token
    Returns:
        list: List of playlists
        {
            "id": str,
            "name": str,
            "owner_id": str
        }
    '''
    url = "https://api.spotify.com/v1/me/playlists"
    headers = {"Authorization": f"Bearer {access_token}"}
    all_playlists = []
    offset = 0
    limit = 50

    while True:
        response = requests.get(url, headers=headers, params={"offset": offset, "limit": limit})
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.json()}")
        data = response.json()
        all_playlists.extend(
            [
                {
                    "id": playlist["id"],
                    "name": playlist["name"],
                    "owner_id": playlist["owner"]["id"]
                } 
                for playlist in data["items"]
            ]
        )
        if len(data["items"]) < limit:
            break
        offset += limit

    # TODO: add to cache
    # get user id from user_id.json file if it exists
    user_id_path = 'user_id.json'
    if os.path.exists(user_id_path):
        with open(user_id_path, 'r') as f:
            current_user_id = json.loads(f.read())['id']
    else:
        current_user_id = get_current_user_id(access_token)
        with open(user_id_path, 'w') as f:
            f.write(json.dumps({'id': current_user_id}))

    playlists = [
        playlist for playlist in all_playlists 
        if playlist["owner_id"] == current_user_id
    ]
    return playlists


def get_playlist_songs(access_token: str, playlist_id: str):
    '''
    Get all songs in a playlist
    Args:
        access_token (str): Spotify access token
        playlist_id (str): Spotify playlist ID
    Returns:
        list: List of songs
        {
            "track": {
                "id": str,
                "name": str,
                "artists": list,
                "album": str
            }
            ...
        }
    '''
    url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
    headers = {"Authorization": f"Bearer {access_token}"}
    all_songs = []
    offset = 0
    limit = 100

    while True:
        response = requests.get(url, headers=headers, params={"offset": offset, "limit": limit})
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.json()}")
        data = response.json()
        all_songs.extend(data["items"])
        if len(data["items"]) < limit:
            break
        offset += limit

    return all_songs


__all__ = ["get_created_playlists", "get_playlist_songs"]