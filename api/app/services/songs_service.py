import os
import json
import time
import logging
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.services.playlists_service import (
    get_created_playlists,
    get_playlist_songs,
    PlaylistIntegrityError,
)
from app.services.http_client import spotify_get, CONCURRENCY_CEILING

logger = logging.getLogger(__name__)

_CACHE_PATH = 'all_uncategorized_songs.json'
_CACHE_VERSION = 2
_CACHE_BUILD_TIMEOUT = 300  # 5 minutes — generous upper bound for large libraries
_FRESHNESS_WINDOW_SECONDS = 15 * 60  # see design.md — starting value, not measured
_LIKED_SONGS_PAGE_SIZE = 50


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


def _fetch_liked_songs_page(access_token: str, offset: int):
    url = f"https://api.spotify.com/v1/me/tracks?limit={_LIKED_SONGS_PAGE_SIZE}&offset={offset}"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = spotify_get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
    return response.json()


def _project_liked_songs(data: dict):
    return [
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


def get_liked_songs(access_token: str, executor: ThreadPoolExecutor = None):
    '''
    Get all liked songs. Pages are fetched concurrently once the first page
    reveals the total count. If `executor` is provided, page fetches are
    submitted to it (letting a caller share one bounded pool across the
    whole build); otherwise a pool of its own is created and torn down for
    the duration of this call.

    Args:
        access_token (str): Spotify access token
        executor (ThreadPoolExecutor, optional): shared pool to fetch pages on
    Returns:
        list: List of liked songs, in the order Spotify returns them
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
    owns_executor = executor is None
    if owns_executor:
        executor = ThreadPoolExecutor(max_workers=CONCURRENCY_CEILING)
    try:
        first = executor.submit(_fetch_liked_songs_page, access_token, 0).result()
        pages = {0: first}
        total = first["total"]

        offsets = range(_LIKED_SONGS_PAGE_SIZE, total, _LIKED_SONGS_PAGE_SIZE)
        futures = {
            executor.submit(_fetch_liked_songs_page, access_token, offset): offset
            for offset in offsets
        }
        for future in as_completed(futures):
            pages[futures[future]] = future.result()

        all_songs = []
        for offset in sorted(pages):
            all_songs.extend(_project_liked_songs(pages[offset]))
        return all_songs
    finally:
        if owns_executor:
            executor.shutdown(wait=True)


# ---------------------------------------------------------------------------
# Index storage: a version-2 envelope ({"version", "built_at", "songs"})
# written atomically, with a process-level cache validated by file mtime so
# repeated paginated reads don't re-parse the whole file.
# ---------------------------------------------------------------------------

_memory_cache_lock = threading.Lock()
_memory_cache = {"abspath": None, "mtime": None, "built_at": None, "songs": None}


def _index_abspath():
    return os.path.abspath(_CACHE_PATH)


def _parse_index_file(abspath: str):
    '''
    Read and parse the stored index. Returns (built_at, songs) if the file
    holds a valid current-format envelope, otherwise None — this covers a
    missing file, unparseable JSON, the legacy bare-array format (version 1),
    and a dict missing the fields this format requires.
    '''
    try:
        with open(abspath, 'r', encoding='utf-8') as f:
            raw = f.read()
    except OSError:
        return None
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("version") != _CACHE_VERSION:
        return None
    built_at = data.get("built_at")
    songs = data.get("songs")
    if built_at is None or not isinstance(songs, list):
        return None
    return built_at, songs


def _get_cached_index():
    '''
    Returns (built_at, songs) for the current on-disk index, or None if no
    valid current-format index exists. Uses the process-level cache when the
    file's mtime still matches what was last read, so repeated calls don't
    re-parse an unchanged file.
    '''
    abspath = _index_abspath()
    try:
        stat = os.stat(abspath)
    except OSError:
        return None

    with _memory_cache_lock:
        if _memory_cache["abspath"] == abspath and _memory_cache["mtime"] == stat.st_mtime:
            return _memory_cache["built_at"], _memory_cache["songs"]

    parsed = _parse_index_file(abspath)
    if parsed is None:
        return None
    built_at, songs = parsed
    with _memory_cache_lock:
        _memory_cache.update({"abspath": abspath, "mtime": stat.st_mtime, "built_at": built_at, "songs": songs})
    return built_at, songs


def _write_index_file(songs: list, built_at: float):
    '''
    Publish the index atomically: write to a temp file in the same directory
    and `os.replace` it onto the target, so a concurrent reader never
    observes a truncated or partially written file — it sees either the
    previous complete index or the new one.
    '''
    abspath = _index_abspath()
    directory = os.path.dirname(abspath) or '.'
    fd, tmp_path = tempfile.mkstemp(prefix='.all_uncategorized_songs.', suffix='.tmp', dir=directory)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump({"version": _CACHE_VERSION, "built_at": built_at, "songs": songs}, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, abspath)
    except BaseException:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise

    stat = os.stat(abspath)
    with _memory_cache_lock:
        _memory_cache.update({"abspath": abspath, "mtime": stat.st_mtime, "built_at": built_at, "songs": songs})


def remove_song_from_index(song_id: str):
    '''
    Remove a single song from the stored index, if a valid index currently
    exists. Preserves the index's existing `built_at` — filing a song is a
    correction to an index of known age, not a rebuild. A no-op if no valid
    index exists yet (nothing to correct).
    '''
    cached = _get_cached_index()
    if cached is None:
        return
    built_at, songs = cached
    filtered = [song for song in songs if song.get('id') != song_id]
    if len(filtered) == len(songs):
        return
    _write_index_file(filtered, built_at)


# ---------------------------------------------------------------------------
# Building the index from Spotify.
# ---------------------------------------------------------------------------

def _build_index_songs(access_token: str):
    '''
    Fetch all liked songs, subtract songs already in user-owned playlists,
    and return the resulting list. Does no file I/O.

    Liked-song pages and each owned playlist's item pages are fetched
    concurrently, bounded by a single shared pool (`page_pool`) so total
    in-flight Spotify requests never exceed the concurrency ceiling
    regardless of how many playlists are being read at once. Playlist reads
    are orchestrated from a second pool (`orchestrator_pool`) whose threads
    only ever wait on `page_pool` futures — never HTTP calls of their own —
    so orchestration can't starve the page pool of workers it needs to make
    progress.
    '''
    with ThreadPoolExecutor(max_workers=CONCURRENCY_CEILING) as page_pool, \
         ThreadPoolExecutor(max_workers=CONCURRENCY_CEILING) as orchestrator_pool:

        liked_future = orchestrator_pool.submit(get_liked_songs, access_token, page_pool)

        # Only considers playlists owned (created) by the user — songs in
        # followed-but-not-owned playlists are still uncategorized.
        all_playlists = get_created_playlists(access_token)

        playlist_futures = {
            orchestrator_pool.submit(get_playlist_songs, access_token, playlist['id'], page_pool): playlist
            for playlist in all_playlists
        }

        all_playlist_song_ids = set()
        for future in as_completed(playlist_futures):
            playlist = playlist_futures[future]
            try:
                all_playlist_song_ids.update(future.result())
            except PlaylistIntegrityError:
                # Never treated as an ordinary per-playlist failure — this
                # signals a broken Spotify `fields` expression, which would
                # affect every playlist identically and silently empty the
                # index if swallowed here. Fail the whole build instead.
                raise
            except Exception as e:
                logger.warning("Skipping playlist %s (%s): %s", playlist['id'], playlist.get('name'), e)
                continue

        all_liked_songs = liked_future.result()

    return [
        song for song in all_liked_songs
        if song['id'] not in all_playlist_song_ids
    ]


_perform_build_lock = threading.Lock()


def _perform_build(access_token: str):
    '''
    Run a full build against Spotify and publish the result. Serialized by
    `_perform_build_lock` so a cold build, a background refresh, and a
    forced refresh can never write concurrently and waste quota racing
    each other.
    '''
    with _perform_build_lock:
        songs = _build_index_songs(access_token)
        built_at = time.time()
        _write_index_file(songs, built_at)
        return songs


# ---------------------------------------------------------------------------
# Cold-build coordination: concurrent requests that arrive with no index on
# disk join a single in-progress build via an Event rather than polling.
# ---------------------------------------------------------------------------

class _BuildInProgress:
    def __init__(self):
        self._event = threading.Event()
        self._result = None
        self._exception = None

    def finish(self, result=None, exception=None):
        self._result = result
        self._exception = exception
        self._event.set()

    def wait(self, timeout):
        completed = self._event.wait(timeout)
        if not completed:
            raise Exception("Timed out waiting for uncategorized songs cache to be created")
        if self._exception is not None:
            raise self._exception
        return self._result


_build_coordination_lock = threading.Lock()
_current_cold_build = None


def _cold_build(access_token: str):
    '''
    Build the index when none exists yet. Only the first caller actually
    builds; every other caller that arrives while it's in progress joins the
    same build and is released as soon as it completes (or fails).
    '''
    global _current_cold_build

    with _build_coordination_lock:
        existing = _current_cold_build
        if existing is not None:
            build = existing
            is_owner = False
        else:
            build = _BuildInProgress()
            _current_cold_build = build
            is_owner = True

    if not is_owner:
        return build.wait(_CACHE_BUILD_TIMEOUT)

    try:
        songs = _perform_build(access_token)
        build.finish(result=songs)
        return songs
    except Exception as e:
        build.finish(exception=e)
        raise
    finally:
        with _build_coordination_lock:
            _current_cold_build = None


# ---------------------------------------------------------------------------
# Freshness: a stale index is served immediately, with a background rebuild
# kicked off behind it. At most one background rebuild runs at a time.
# ---------------------------------------------------------------------------

_background_refresh_lock = threading.Lock()
_background_refresh_running = False


def _is_stale(built_at: float) -> bool:
    return (time.time() - built_at) >= _FRESHNESS_WINDOW_SECONDS


def _spawn_daemon(target):
    '''Seam for tests: monkeypatch to run `target` synchronously instead.'''
    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    return thread


def _run_background_refresh(access_token: str):
    global _background_refresh_running
    try:
        _perform_build(access_token)
    except Exception as e:
        logger.warning("Background rebuild of uncategorized songs index failed: %s", e)
    finally:
        with _background_refresh_lock:
            _background_refresh_running = False


def _maybe_start_background_refresh(access_token: str):
    global _background_refresh_running
    with _background_refresh_lock:
        if _background_refresh_running:
            return
        _background_refresh_running = True
    _spawn_daemon(lambda: _run_background_refresh(access_token))


def force_rebuild(access_token: str) -> int:
    '''
    Rebuild the index from Spotify synchronously, ignoring the freshness
    window — used by the user-initiated refresh endpoint so a change made
    directly in Spotify can be picked up without logging out.
    Returns:
        int: total number of songs in the rebuilt index
    '''
    songs = _perform_build(access_token)
    return len(songs)


# ---------------------------------------------------------------------------
# Public read paths.
# ---------------------------------------------------------------------------

def get_uncategorized_songs(access_token: str, offset: int, limit: int):
    '''
    Get uncategorized songs (paginated).

    On the first call after login the index is built synchronously, shared
    by any concurrent callers. A stale index (older than the freshness
    window) is served immediately while a background rebuild runs behind it.

    Args:
        access_token (str): Spotify access token
        offset (int): Offset
        limit (int): Limit
    Returns:
        list: Slice of uncategorized songs
    '''
    cached = _get_cached_index()
    if cached is not None:
        built_at, songs = cached
        if _is_stale(built_at):
            _maybe_start_background_refresh(access_token)
        return songs[offset:offset + limit]

    songs = _cold_build(access_token)
    return songs[offset:offset + limit]


def _wait_for_cache(timeout: int = _CACHE_BUILD_TIMEOUT):
    '''
    Poll until a valid index appears or the timeout is exceeded.
    Raises Exception on timeout.
    '''
    elapsed = 0
    while _get_cached_index() is None:
        if elapsed >= timeout:
            raise Exception("Timed out waiting for uncategorized songs cache to be created")
        time.sleep(2)
        elapsed += 2


def get_total_uncategorized_songs():
    '''
    Get total number of uncategorized songs.

    This endpoint has no access token of its own and so cannot start a
    build. If a build is already in progress (typically triggered by a
    concurrent request for a page of songs), this waits on it directly
    rather than polling. Otherwise it waits for the cache to be created
    externally, for up to `_CACHE_BUILD_TIMEOUT` seconds.

    Returns:
        int: Total number of uncategorized songs
    '''
    cached = _get_cached_index()
    if cached is not None:
        return len(cached[1])

    with _build_coordination_lock:
        build = _current_cold_build

    if build is not None:
        return len(build.wait(_CACHE_BUILD_TIMEOUT))

    _wait_for_cache()
    cached = _get_cached_index()
    if cached is None:
        raise Exception("Timed out waiting for uncategorized songs cache to be created")
    return len(cached[1])


__all__ = [
    "get_uncategorized_songs",
    "get_total_uncategorized_songs",
    "remove_song_from_index",
    "force_rebuild",
]
