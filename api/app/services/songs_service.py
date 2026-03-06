import os
import json
import time
import threading
from app.services.playlists_service import get_created_playlists, get_playlist_songs
from app.services.http_client import spotify_get

# Module-level lock: only one thread may build the cache at a time.
# Other threads that arrive while the build is in progress will poll for
# the cache file instead of starting a redundant build.
_build_lock = threading.Lock()

_CACHE_PATH = 'all_uncategorized_songs.json'
_CACHE_BUILD_TIMEOUT = 300  # 5 minutes — generous upper bound for large libraries


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
    response = spotify_get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
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
        response = spotify_get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.text}")

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
                if item.get("track") and item["track"].get("id")
            ]
        )
        offset += 50

    return all_songs


def _wait_for_cache(timeout: int = _CACHE_BUILD_TIMEOUT):
    '''
    Poll until the cache file appears or the timeout is exceeded.
    Raises Exception on timeout.
    '''
    elapsed = 0
    while not os.path.exists(_CACHE_PATH):
        if elapsed >= timeout:
            raise Exception("Timed out waiting for uncategorized songs cache to be created")
        time.sleep(2)
        elapsed += 2


def _build_cache(access_token: str):
    '''
    Fetch all liked songs, subtract songs already in user-owned playlists,
    and write the result to the cache file.
    '''
    all_liked_songs = get_liked_songs(access_token)
    # Only consider playlists owned (created) by the user.
    # Songs in followed-but-not-owned playlists are still uncategorized.
    all_playlists = get_created_playlists(access_token)

    all_playlist_songs = []
    for playlist in all_playlists:
        try:
            all_playlist_songs.extend(get_playlist_songs(access_token, playlist['id']))
        except Exception as e:
            print(f"Warning: skipping playlist {playlist['id']} ({playlist['name']}): {e}")
            continue

    # Guard against None tracks (removed songs, podcast episodes) returned
    # by the /items endpoint — these have track: null in the API response.
    all_playlist_song_ids = set(
        song['track']['id']
        for song in all_playlist_songs
        if song.get('track') and song['track'].get('id')
    )

    all_uncategorized_songs = [
        song for song in all_liked_songs
        if song['id'] not in all_playlist_song_ids
    ]

    with open(_CACHE_PATH, 'w') as f:
        f.write(json.dumps(all_uncategorized_songs))

    return all_uncategorized_songs


def get_uncategorized_songs(access_token: str, offset: int, limit: int):
    '''
    Get uncategorized songs (paginated).

    On the first call after login the cache is built synchronously.
    Concurrent requests that arrive while the cache is being built will
    wait (by polling) rather than starting a redundant build.

    Args:
        access_token (str): Spotify access token
        offset (int): Offset
        limit (int): Limit
    Returns:
        list: Slice of uncategorized songs
    '''
    # Fast path: cache already exists.
    if os.path.exists(_CACHE_PATH):
        with open(_CACHE_PATH, 'r') as f:
            return json.loads(f.read())[offset:offset + limit]

    # Try to become the builder.  Non-blocking acquire so that concurrent
    # requests fall through to the polling path immediately.
    acquired = _build_lock.acquire(blocking=False)

    if not acquired:
        # Another thread is already building the cache — wait for it.
        _wait_for_cache()
        with open(_CACHE_PATH, 'r') as f:
            return json.loads(f.read())[offset:offset + limit]

    # We hold the lock — build the cache.
    try:
        # Re-check after acquiring: a previous request may have just finished.
        if os.path.exists(_CACHE_PATH):
            with open(_CACHE_PATH, 'r') as f:
                return json.loads(f.read())[offset:offset + limit]

        all_uncategorized_songs = _build_cache(access_token)
        return all_uncategorized_songs[offset:offset + limit]
    finally:
        _build_lock.release()


def get_total_uncategorized_songs():
    '''
    Get total number of uncategorized songs.
    Waits up to _CACHE_BUILD_TIMEOUT seconds for the cache to be created
    if it does not yet exist (i.e. the first build is still in progress).
    Returns:
        int: Total number of uncategorized songs
    '''
    if not os.path.exists(_CACHE_PATH):
        _wait_for_cache()

    with open(_CACHE_PATH, 'r') as f:
        all_uncategorized_songs = json.loads(f.read())

    return len(all_uncategorized_songs)


__all__ = ["get_uncategorized_songs", "get_total_uncategorized_songs"]
