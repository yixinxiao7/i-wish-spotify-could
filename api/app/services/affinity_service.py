import os
import json
import time
import logging
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.services.http_client import spotify_get, CONCURRENCY_CEILING
from app.services.token_service import get_granted_scopes

logger = logging.getLogger(__name__)

REQUIRED_SCOPE = "user-top-read"

_TIME_RANGES = ("short_term", "medium_term", "long_term")
_TIME_RANGE_TIERS = {"long_term": 1, "medium_term": 2, "short_term": 3}
_TOP_TRACKS_LIMIT = 50

_CACHE_PATH = "track_affinity.json"
_CACHE_VERSION = 1
_FRESHNESS_WINDOW_SECONDS = 24 * 60 * 60  # see design.md — daily top-tracks cadence


def _fetch_top_tracks(access_token: str, time_range: str):
    url = f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit={_TOP_TRACKS_LIMIT}"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = spotify_get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
    return response.json()


def _build_tiers(access_token: str) -> dict:
    '''
    Fetch all three top-tracks time ranges concurrently on the shared pool
    and reduce them to a {track_id: tier} map. A track absent from every
    range simply has no entry — callers look it up with a tier-0 default.
    '''
    with ThreadPoolExecutor(max_workers=CONCURRENCY_CEILING) as executor:
        futures = {
            executor.submit(_fetch_top_tracks, access_token, time_range): time_range
            for time_range in _TIME_RANGES
        }
        results = {}
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    tiers = {}
    # Lowest tier first so a track present in multiple ranges ends up at
    # its highest (most-recently-listened) tier.
    for time_range in ("long_term", "medium_term", "short_term"):
        tier = _TIME_RANGE_TIERS[time_range]
        for item in results[time_range].get("items", []):
            track_id = item.get("id")
            if track_id:
                tiers[track_id] = tier
    return tiers


def get_tier(tiers: dict, track_id: str) -> int:
    '''
    Look up a track's affinity tier. Absent from every top-tracks range
    reports tier 0 — "no listening signal", not an error.
    '''
    return tiers.get(track_id, 0)


# ---------------------------------------------------------------------------
# Storage: a versioned envelope ({"version", "built_at", "tiers"}) written
# atomically, with a process-level cache validated by file mtime — the same
# pattern songs_service uses for the uncategorized index.
# ---------------------------------------------------------------------------

_memory_cache_lock = threading.Lock()
_memory_cache = {"abspath": None, "mtime": None, "built_at": None, "tiers": None}


def _cache_abspath():
    return os.path.abspath(_CACHE_PATH)


def _parse_cache_file(abspath: str):
    '''
    Read and parse the stored affinity cache. Returns (built_at, tiers) for
    a valid current-format envelope, otherwise None — covering a missing
    file, unparseable JSON, a version mismatch, and a dict missing the
    fields this format requires.
    '''
    try:
        with open(abspath, "r", encoding="utf-8") as f:
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
    tiers = data.get("tiers")
    if built_at is None or not isinstance(tiers, dict):
        return None
    return built_at, tiers


def _get_cached_affinity():
    abspath = _cache_abspath()
    try:
        stat = os.stat(abspath)
    except OSError:
        return None

    with _memory_cache_lock:
        if _memory_cache["abspath"] == abspath and _memory_cache["mtime"] == stat.st_mtime:
            return _memory_cache["built_at"], _memory_cache["tiers"]

    parsed = _parse_cache_file(abspath)
    if parsed is None:
        return None
    built_at, tiers = parsed
    with _memory_cache_lock:
        _memory_cache.update({"abspath": abspath, "mtime": stat.st_mtime, "built_at": built_at, "tiers": tiers})
    return built_at, tiers


def _write_cache_file(tiers: dict, built_at: float):
    abspath = _cache_abspath()
    directory = os.path.dirname(abspath) or "."
    fd, tmp_path = tempfile.mkstemp(prefix=".track_affinity.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump({"version": _CACHE_VERSION, "built_at": built_at, "tiers": tiers}, f)
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
        _memory_cache.update({"abspath": abspath, "mtime": stat.st_mtime, "built_at": built_at, "tiers": tiers})


def _is_stale(built_at: float) -> bool:
    return (time.time() - built_at) >= _FRESHNESS_WINDOW_SECONDS


def _perform_build(access_token: str) -> dict:
    tiers = _build_tiers(access_token)
    _write_cache_file(tiers, time.time())
    return tiers


# ---------------------------------------------------------------------------
# Single-flight build coordination: every caller that needs a build (cold or
# refreshing a stale cache) either becomes the builder or joins the one
# already in progress via an Event, rather than issuing its own requests.
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
            raise Exception("Timed out waiting for affinity data to be built")
        if self._exception is not None:
            raise self._exception
        return self._result


_build_coordination_lock = threading.Lock()
_current_build = None


def _coordinated_build(access_token: str) -> dict:
    global _current_build

    with _build_coordination_lock:
        existing = _current_build
        if existing is not None:
            build = existing
            is_owner = False
        else:
            build = _BuildInProgress()
            _current_build = build
            is_owner = True

    if not is_owner:
        return build.wait(60)

    try:
        tiers = _perform_build(access_token)
        build.finish(result=tiers)
        return tiers
    except Exception as e:
        build.finish(exception=e)
        raise
    finally:
        with _build_coordination_lock:
            _current_build = None


# ---------------------------------------------------------------------------
# Public read path.
# ---------------------------------------------------------------------------

def get_affinity(access_token: str) -> dict:
    '''
    Get the current listening-affinity signal, building or refreshing it as
    needed.

    A missing `user-top-read` scope is detected from stored token state
    before any request is made. Any other failure to build or refresh
    reports affinity as unavailable for that request; a previously cached
    map, if one exists, is preserved and kept in use rather than discarded.

    Args:
        access_token (str): Spotify access token
    Returns:
        dict:
        {
            "available": bool,
            "reason": str | None,   # "missing_scope" | "upstream_error", only when unavailable
            "tiers": dict | None    # {track_id: int}, present iff available
        }
    '''
    if REQUIRED_SCOPE not in get_granted_scopes():
        return {"available": False, "reason": "missing_scope", "tiers": None}

    cached = _get_cached_affinity()
    if cached is None:
        try:
            tiers = _coordinated_build(access_token)
        except Exception as e:
            logger.warning("Failed to build listening-affinity data: %s", e)
            return {"available": False, "reason": "upstream_error", "tiers": None}
        return {"available": True, "reason": None, "tiers": tiers}

    built_at, tiers = cached
    if not _is_stale(built_at):
        return {"available": True, "reason": None, "tiers": tiers}

    try:
        tiers = _coordinated_build(access_token)
    except Exception as e:
        logger.warning("Failed to refresh listening-affinity data, serving previous cache: %s", e)
        return {"available": True, "reason": None, "tiers": tiers}
    return {"available": True, "reason": None, "tiers": tiers}


__all__ = ["get_affinity", "get_tier", "REQUIRED_SCOPE"]
