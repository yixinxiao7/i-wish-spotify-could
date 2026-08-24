import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.services.http_client import spotify_get, CONCURRENCY_CEILING
from app.services.playlists_service import PlaylistIntegrityError

_PLAYLIST_ITEMS_PAGE_SIZE = 100
# Superset of playlists_service's ID-only projection: this feature needs
# enough per-song detail to render a SongCard and enough per-item detail
# (added_at) to sort by it. Same failure mode as the ID-only projection — a
# broken `fields` expression yields structurally valid but empty items — so
# it reuses the same PlaylistIntegrityError guard below.
_PLAYLIST_SONGS_FIELDS = "items(added_at,item(id,name,artists(name),album(name,images))),next,total"

SORT_KEYS = ("playlist", "added_asc", "added_desc", "affinity_asc")


def _fetch_playlist_items_page(access_token: str, playlist_id: str, offset: int):
    url = (
        f"https://api.spotify.com/v1/playlists/{playlist_id}/items"
        f"?limit={_PLAYLIST_ITEMS_PAGE_SIZE}&offset={offset}&fields={_PLAYLIST_SONGS_FIELDS}"
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    response = spotify_get(url, headers=headers)
    if response.status_code == 403:
        raise PermissionError(f"403 Forbidden for playlist {playlist_id}: {response.text}")
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
    return response.json()


def _project_item(raw_item: dict):
    item = raw_item.get("item")
    if not item or not item.get("id"):
        return None
    album = item.get("album") or {}
    images = album.get("images") or []
    return {
        "id": item["id"],
        "name": item.get("name"),
        "artists": ", ".join(a["name"] for a in (item.get("artists") or []) if a.get("name")),
        "album": album.get("name"),
        "album_pic_url": images[0]["url"] if images else None,
        "added_at": raw_item.get("added_at"),
    }


def _extract_songs(data: dict):
    songs = []
    for raw_item in data.get("items", []):
        song = _project_item(raw_item)
        if song:
            songs.append(song)
    return songs


def fetch_all_playlist_songs(access_token: str, playlist_id: str, executor: ThreadPoolExecutor = None):
    '''
    Fetch every song in a playlist, in Spotify's playlist order, with
    enough detail to render and sort them: id, name, artists, album,
    album art, and the date each was added to the playlist.

    Pages are fetched concurrently once the first page reveals the total
    track count, mirroring playlists_service.get_playlist_songs. If
    `executor` is provided, page fetches are submitted to it; otherwise a
    pool of its own, sized to the shared concurrency ceiling, is created
    and torn down for the duration of this call.

    Args:
        access_token (str): Spotify access token
        playlist_id (str): Spotify playlist ID
        executor (ThreadPoolExecutor, optional): shared pool to fetch pages on
    Returns:
        list[dict]: songs in playlist order, each with id, name, artists,
            album, album_pic_url, added_at
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

        all_songs = [song for offset in sorted(pages) for song in _extract_songs(pages[offset])]

        if total and len(all_songs) == 0:
            raise PlaylistIntegrityError(
                f"Playlist {playlist_id} reports {total} tracks but the filtered "
                "items response yielded no songs — the Spotify `fields` "
                "expression may be broken"
            )

        return all_songs
    finally:
        if owns_executor:
            executor.shutdown(wait=True)


def sort_songs(songs: list, sort: str, affinity_tiers: dict = None):
    '''
    Order a full song list. `playlist` returns Spotify's order unchanged;
    `added_asc`/`added_desc` order by `added_at`; `affinity_asc` orders by
    listening-affinity tier ascending, breaking ties by `added_at` oldest
    first — the least-listened, longest-held songs surface first. Ties are
    broken by preserving relative playlist order (Python's sort is stable,
    including under `reverse=True`), so ordering is deterministic across
    repeated calls for the same playlist state.
    Args:
        songs (list[dict]): songs as returned by fetch_all_playlist_songs
        sort (str): one of SORT_KEYS
        affinity_tiers (dict, optional): {track_id: tier}, used only for
            "affinity_asc"; a track absent from it sorts as tier 0
    Returns:
        list[dict]: songs in the requested order
    Raises:
        ValueError: `sort` is not a recognized key
    '''
    if sort not in SORT_KEYS:
        raise ValueError(f"Unknown sort: {sort!r}")

    if sort == "playlist":
        return list(songs)
    if sort == "added_asc":
        return sorted(songs, key=lambda s: s["added_at"])
    if sort == "added_desc":
        return sorted(songs, key=lambda s: s["added_at"], reverse=True)

    # affinity_asc
    tiers = affinity_tiers or {}
    return sorted(songs, key=lambda s: (tiers.get(s["id"], 0), s["added_at"]))


# ---------------------------------------------------------------------------
# Per-playlist cache: in-memory only (no runtime file), keyed by playlist ID.
# Removal invalidates a playlist's entry directly (see playlists_service);
# the freshness window otherwise bounds how long a second tab or a repeated
# visit can see a playlist without re-fetching it.
# ---------------------------------------------------------------------------

_CACHE_FRESHNESS_SECONDS = 5 * 60

_cache_lock = threading.Lock()
_cache: dict = {}


def _get_cached_songs(playlist_id: str):
    with _cache_lock:
        entry = _cache.get(playlist_id)
    if entry is None:
        return None
    built_at, songs = entry
    if (time.time() - built_at) >= _CACHE_FRESHNESS_SECONDS:
        return None
    return songs


def _set_cached_songs(playlist_id: str, songs: list):
    with _cache_lock:
        _cache[playlist_id] = (time.time(), songs)


def invalidate_playlist_cache(playlist_id: str):
    '''Drop a playlist's cached song list, e.g. after a successful removal.'''
    with _cache_lock:
        _cache.pop(playlist_id, None)


def get_playlist_songs_page(
    access_token: str,
    playlist_id: str,
    offset: int,
    limit: int,
    sort: str,
    affinity_tiers: dict = None,
    executor: ThreadPoolExecutor = None,
):
    '''
    Get one page of a playlist's songs, ordered as requested, computed over
    the whole playlist rather than just the returned page.
    Args:
        access_token (str): Spotify access token
        playlist_id (str): Spotify playlist ID
        offset (int): Offset into the ordered list
        limit (int): Page size
        sort (str): one of SORT_KEYS
        affinity_tiers (dict, optional): {track_id: tier} for "affinity_asc"
        executor (ThreadPoolExecutor, optional): shared pool for a cold fetch
    Returns:
        tuple[list[dict], int]: (page of songs — each carrying affinity_tier,
            0 when affinity_tiers is not provided — and total songs in the
            playlist)
    Raises:
        ValueError: `sort` is not a recognized key
        PermissionError: the playlist could not be read (403)
        PlaylistIntegrityError: see fetch_all_playlist_songs
    '''
    if sort not in SORT_KEYS:
        raise ValueError(f"Unknown sort: {sort!r}")

    songs = _get_cached_songs(playlist_id)
    if songs is None:
        songs = fetch_all_playlist_songs(access_token, playlist_id, executor)
        _set_cached_songs(playlist_id, songs)

    ordered = sort_songs(songs, sort, affinity_tiers)
    page = ordered[offset:offset + limit]

    # Attach each song's tier at read time rather than storing it on the
    # cached list — affinity_tiers can refresh independently of the
    # playlist's own cache, so a page always reflects the tiers passed to
    # this call rather than a snapshot baked in when the playlist was cached.
    tiers = affinity_tiers or {}
    page_with_tier = [{**song, "affinity_tier": tiers.get(song["id"], 0)} for song in page]

    return page_with_tier, len(ordered)


__all__ = [
    "SORT_KEYS",
    "fetch_all_playlist_songs",
    "sort_songs",
    "get_playlist_songs_page",
    "invalidate_playlist_cache",
]
