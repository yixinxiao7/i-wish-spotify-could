import requests
import os
import json
import time
from app.services.playlists_service import get_created_playlists, get_playlist_songs


def get_total_liked_songs(access_token: str):
    '''
    Get total number of liked songs
    Args:
        access_token (str): Spotify access token
    Returns:
        int: Total number of liked songs
    '''
    url = "https://api.spotify.com/v1/me/tracks?limit=1"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.json()}")
    data = response.json()
    return data["total"]


def get_liked_songs(access_token: str):
    '''
    Get all liked songs
    Args:
        access_token (str): Spotify access token
    Returns:
        list: List of liked songs
        [
            {
                "id": str,
                "name": str,
                "artists": str,
                "album": str,
                "album_pic_url": str
            }
        ]
    '''
    all_songs = []
    offset = 0
    total = 1
    while offset < total:
        url = f"https://api.spotify.com/v1/me/tracks?limit=50&offset={offset}"
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.json()}")

        data = response.json()
        total = data["total"]
        all_songs.extend(
            [
                {
                    "id": item["track"]["id"],
                    "name": item["track"]["name"],
                    "artists": ", ".join(artist["name"] for artist in item["track"]["artists"]),
                    "album": item["track"]["album"]["name"],
                    "album_pic_url": item["track"]["album"]["images"][0]["url"] if item["track"]["album"]["images"] else None,
                }
                for item in data["items"]
            ]
        )
        offset += 50

    return all_songs


def get_uncategorized_songs(access_token: str, offset:int, limit:int):
    '''
    Get uncategorized songs
    Args:
        access_token (str): Spotify access token
        offset (int): Offset
        limit (int): Limit
    Returns:
        list: List of uncategorized songs
        [
            {
                "id": str,
                "name": str,
                "artists": str,
                "album": str,
                "album_pic_url": str
            }
        ]
    '''
    # TODO: implement cache to save all songs
    all_uncategorized_songs_path = 'all_uncategorized_songs.json'
    if os.path.exists(all_uncategorized_songs_path):
        with open(all_uncategorized_songs_path, 'r') as f:
            all_uncategorized_songs = json.loads(f.read())
    else:
        # determine which songs are not in any playlists
        all_liked_songs = get_liked_songs(access_token)
        all_playlists = get_created_playlists(access_token)
        all_playlist_songs = []
        for playlist in all_playlists:
            all_playlist_songs.extend(get_playlist_songs(access_token, playlist['id']))
        all_playlist_song_ids = set([song['track']['id'] for song in all_playlist_songs])
        all_uncategorized_songs = [song for song in all_liked_songs if song['id'] not in all_playlist_song_ids]
        with open(all_uncategorized_songs_path, 'w') as f:
            f.write(json.dumps(all_uncategorized_songs))

    return all_uncategorized_songs[offset:offset+limit]

def get_total_uncategorized_songs():
    '''
    Get total number of uncategorized songs
    Returns:
        int: Total number of uncategorized songs
    '''
    all_uncategorized_songs_path = 'all_uncategorized_songs.json'
    timeout = 30
    elapsed = 0
    while not os.path.exists(all_uncategorized_songs_path):
        if elapsed >= timeout:
            raise Exception("Timed out waiting for uncategorized songs cache to be created")
        time.sleep(1)
        elapsed += 1

    with open(all_uncategorized_songs_path, 'r') as f:
        all_uncategorized_songs = json.loads(f.read())

    return len(all_uncategorized_songs)


__all__ = ["get_uncategorized_songs", "get_total_uncategorized_songs"]