import os
import json
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.services.users_services import get_current_user_id
from app.services.http_client import spotify_get, spotify_post, CONCURRENCY_CEILING

_PLAYLIST_ITEMS_PAGE_SIZE = 100
_PLAYLIST_ITEMS_FIELDS = "items(item(id)),next,total"


class PlaylistIntegrityError(Exception):
    '''
    Raised when a playlist's filtered items response looks like a broken
    Spotify `fields` expression rather than an ordinary per-playlist failure
    (empty access, deleted playlist, etc). This must never be swallowed the
    way an ordinary playlist failure is — a broken fields expression affects
    every playlist identically and would otherwise silently empty the
    uncategorized-songs index instead of failing loudly.
    '''
    pass


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


def _fetch_playlist_items_page(access_token: str, playlist_id: str, offset: int):
    url = (
        f"https://api.spotify.com/v1/playlists/{playlist_id}/items"
        f"?limit={_PLAYLIST_ITEMS_PAGE_SIZE}&offset={offset}&fields={_PLAYLIST_ITEMS_FIELDS}"
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    response = spotify_get(url, headers=headers)
    if response.status_code == 403:
        raise PermissionError(f"403 Forbidden for playlist {playlist_id}: {response.text}")
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
    return response.json()


def _extract_track_ids(data: dict):
    ids = []
    for raw_item in data.get("items", []):
        # The /items endpoint returns the track/episode object under the
        # 'item' key; guard for 'track' too in case the shape ever varies.
        item = raw_item.get("item") or raw_item.get("track")
        if item and item.get("id"):
            ids.append(item["id"])
    return ids


def get_playlist_songs(access_token: str, playlist_id: str, executor: ThreadPoolExecutor = None):
    '''
    Get the track IDs of every song in a playlist. Only IDs are requested
    from Spotify (via `fields=`) since that is all the uncategorized-songs
    build needs to compute a set difference.

    Pages are fetched concurrently once the first page reveals the total
    track count. If `executor` is provided, page fetches are submitted to
    it (letting a caller share one bounded pool across many playlists);
    otherwise a pool of its own, sized to the shared concurrency ceiling, is
    created and torn down for the duration of this call.

    Args:
        access_token (str): Spotify access token
        playlist_id (str): Spotify playlist ID
        executor (ThreadPoolExecutor, optional): shared pool to fetch pages on
    Returns:
        list[str]: track IDs, in playlist order
    Raises:
        PermissionError: the playlist could not be read (403)
        PlaylistIntegrityError: the playlist reports tracks but the filtered
            response yielded none — almost certainly a broken `fields`
            expression, not a real empty playlist
    '''
    owns_executor = executor is None
    if owns_executor:
        executor = ThreadPoolExecutor(max_workers=CONCURRENCY_CEILING)
    try:
        first = executor.submit(_fetch_playlist_items_page, access_token, playlist_id, 0).result()
        pages = {0: first}
        total = first.get("total")
        if total:
            offsets = range(_PLAYLIST_ITEMS_PAGE_SIZE, total, _PLAYLIST_ITEMS_PAGE_SIZE)
            futures = {
                executor.submit(_fetch_playlist_items_page, access_token, playlist_id, offset): offset
                for offset in offsets
            }
            for future in as_completed(futures):
                pages[futures[future]] = future.result()

        all_ids = [tid for offset in sorted(pages) for tid in _extract_track_ids(pages[offset])]

        if total and len(all_ids) == 0:
            raise PlaylistIntegrityError(
                f"Playlist {playlist_id} reports {total} tracks but the filtered "
                "items response yielded no track IDs — the Spotify `fields` "
                "expression may be broken"
            )

        return all_ids
    finally:
        if owns_executor:
            executor.shutdown(wait=True)


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

    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY_CEILING) as executor:
        futures = [executor.submit(add_song, playlist_id) for playlist_id in playlist_ids]
        for future in concurrent.futures.as_completed(futures):
            future.result()


__all__ = [
    "get_all_library_playlists",
    "get_created_playlists",
    "get_playlist_songs",
    "add_song_to_playlists",
    "PlaylistIntegrityError",
]
