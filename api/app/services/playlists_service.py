import os
import json
import concurrent.futures
from app.services.users_services import get_current_user_id
from app.services.http_client import spotify_get, spotify_post


def _fetch_all_playlists(access_token: str):
    '''
    Fetch every playlist that appears in the current user's Spotify library
    (both owned and followed).  Pagination is handled internally.
    Args:
        access_token (str): Spotify access token
    Returns:
        list of dicts with keys: id, name, owner_id, playlist_image_url
    '''
    url = "https://api.spotify.com/v1/me/playlists?limit=50"
    headers = {"Authorization": f"Bearer {access_token}"}
    all_playlists = []

    while url:
        response = spotify_get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.text}")
        data = response.json()
        all_playlists.extend(
            [
                {
                    "id": playlist["id"],
                    "name": playlist["name"],
                    "owner_id": playlist["owner"]["id"],
                    "playlist_image_url": playlist["images"][0]["url"] if playlist["images"] else None,
                }
                for playlist in data["items"]
            ]
        )
        url = data.get("next")

    return all_playlists


def get_all_library_playlists(access_token: str):
    '''
    Get every playlist in the user's Spotify library — both playlists they
    own and playlists they follow.  Used when building the uncategorized-songs
    cache so that songs in any library playlist are excluded.
    Args:
        access_token (str): Spotify access token
    Returns:
        list: List of playlists
        {
            "id": str,
            "name": str,
            "owner_id": str,
            "playlist_image_url": str | None
        }
    '''
    return _fetch_all_playlists(access_token)


def get_created_playlists(access_token: str):
    '''
    Get all playlists owned (created) by the current user.
    Used for the add-to-playlist UI — users can only add songs to playlists
    they own.
    Args:
        access_token (str): Spotify access token
    Returns:
        list: List of playlists
        {
            "id": str,
            "name": str,
            "owner_id": str,
            "playlist_image_url": str | None
        }
    '''
    all_playlists = _fetch_all_playlists(access_token)

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
    url = f"https://api.spotify.com/v1/playlists/{playlist_id}/items?limit=100"
    headers = {"Authorization": f"Bearer {access_token}"}
    all_songs = []

    while url:
        response = spotify_get(url, headers=headers)
        if response.status_code == 403:
            raise PermissionError(f"403 Forbidden for playlist {playlist_id}: {response.text}")
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.text}")
        data = response.json()
        for raw_item in data["items"]:
            # The /items endpoint returns the track/episode object under
            # the 'item' key instead of 'track'.  Normalise so downstream
            # code can consistently use item['track'].
            if "track" not in raw_item and "item" in raw_item:
                raw_item["track"] = raw_item["item"]
            all_songs.append(raw_item)
        url = data.get("next")

    return all_songs


def add_song_to_playlists(access_token: str, song_id: str, playlist_ids: list):
    '''
    Add a song to multiple playlists
    Args:
        access_token (str): Spotify access token
        song_id (str): Spotify song ID
        playlist_ids (list): List of playlist IDs to add the song to
    Returns:
        None
    '''
    
    def add_song(playlist_id):
        url = f"https://api.spotify.com/v1/playlists/{playlist_id}/items"
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {"uris": [f"spotify:track:{song_id}"]}
        response = spotify_post(url, headers=headers, json=data)
        if response.status_code == 403:
            raise PermissionError(f"Permission denied for playlist {playlist_id} — re-login may be required")
        if response.status_code not in (200, 201):
            raise Exception(f"Error adding song to playlist {playlist_id}: {response.status_code} - {response.text}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(add_song, playlist_id) for playlist_id in playlist_ids]
        for future in concurrent.futures.as_completed(futures):
            future.result()


__all__ = ["get_all_library_playlists", "get_created_playlists", "get_playlist_songs", "add_song_to_playlists"]