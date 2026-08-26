from fastapi import APIRouter, HTTPException, Query
from app.services.playlists_service import (
    get_created_playlists,
    add_song_to_playlists,
    remove_song_from_playlist,
)
from app.services.token_service import get_valid_token
from app.services.pins_service import read_pins, set_pin, apply_pins
from app.services.songs_service import remove_song_from_index, mark_index_stale
from app.services.playlist_songs_service import (
    get_playlist_songs_page,
    get_playlist_song_ids,
    invalidate_playlist_cache,
    SORT_KEYS,
)
from app.services.affinity_service import get_affinity
from app.services.http_client import SpotifyRateLimitedError
from app.models.schemas import SongPostData, PinPostData, RemoveSongData
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

RATE_LIMIT_DETAIL = (
    "Spotify is rate limiting this app right now. This usually clears on its "
    "own within an hour — please try again later."
)

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
    try:
        playlists = get_created_playlists(token)
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited fetching playlists: %s", str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except Exception as e:
        # Without this, an unhandled exception returns a bare 500 that
        # CORSMiddleware never annotates, so the browser reports a confusing
        # CORS violation instead of the actual failure.
        logger.error("Failed to fetch playlists: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to load playlists.")
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
        remove_song_from_index(song_id)
        # A target playlist's cached song list would otherwise still be
        # missing this song until the cache's freshness window elapses,
        # letting song-propagation offer it as a candidate again and add
        # it a second time (Spotify allows duplicate entries).
        for playlist_id in playlist_ids:
            invalidate_playlist_cache(playlist_id)

    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited adding song %s to playlists: %s", song_id, str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except PermissionError as e:
        logger.warning("Permission denied adding song %s to playlists: %s", song_id, str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Failed to add song %s to playlists: %s", song_id, str(e))
        raise HTTPException(status_code=500, detail="Failed to add song to playlists")

    return {"message": "Song added to playlists successfully!"}


def _find_owned_playlists(token: str, playlist_ids: set):
    '''
    Resolve several owned-playlist IDs from a single get_created_playlists()
    call, so validating a path playlist and an excluded playlist (song
    propagation) costs one /me/playlists request rather than one per ID —
    the endpoint most likely to be rate limited (CONTEXT.md Sec.4).
    Args:
        token (str): Spotify access token
        playlist_ids (set[str]): IDs to resolve
    Returns:
        dict[str, dict]: playlist_id -> playlist, for IDs that are owned;
            IDs not found or not owned are simply absent
    '''
    owned = get_created_playlists(token)
    found = {p["id"]: p for p in owned if p["id"] in playlist_ids}
    return found


@router.get("/{playlist_id}/songs")
def get_playlist_songs(
    playlist_id: str,
    offset: int = Query(0, ge=0, description="Offset"),
    limit: int = Query(10, ge=1, le=100, description="Limit"),
    sort: str = Query("playlist", description="One of: " + ", ".join(SORT_KEYS)),
    exclude_playlist_id: str | None = Query(
        None, description="If set, omit songs already in this owned playlist (used by song propagation)"
    ),
):
    '''
    Get one page of a playlist's songs, ordered as requested. When
    exclude_playlist_id is given, songs already present in that (owned)
    playlist are omitted before ordering and pagination, and the reported
    total reflects the exclusion.
    Args:
        playlist_id (str): Spotify playlist ID
        offset (int): Offset into the ordered list (>= 0)
        limit (int): Page size (1-100)
        sort (str): "playlist" | "added_asc" | "added_desc" | "affinity_asc"
        exclude_playlist_id (str, optional): owned playlist ID whose songs
            should be omitted from the result
    Returns:
        dict:
        {
            "playlist": {"id": str, "name": str},
            "songs": list[{"id": str, "name": str, "artists": str, "album": str,
                           "album_pic_url": str | None, "added_at": str,
                           "affinity_tier": int}],
            "total": int,
            "affinity": {"available": bool, "reason": str | None}
        }
    '''
    if sort not in SORT_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown sort: {sort!r}")

    if exclude_playlist_id is not None and exclude_playlist_id == playlist_id:
        raise HTTPException(status_code=400, detail="exclude_playlist_id cannot be the playlist being listed")

    token = get_valid_token()
    ids_to_resolve = {playlist_id} | ({exclude_playlist_id} if exclude_playlist_id else set())
    try:
        resolved = _find_owned_playlists(token, ids_to_resolve)
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited looking up playlist %s: %s", playlist_id, str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except Exception as e:
        # This lookup calls Spotify, so it can fail for reasons that have
        # nothing to do with the playlist existing — a rate limit, most
        # notably. Reporting those as a load failure keeps them out of the
        # 404 branch below, which would otherwise tell the user their
        # playlist doesn't exist when the real problem is transient.
        logger.error("Failed to look up playlist %s: %s", playlist_id, str(e))
        raise HTTPException(status_code=502, detail="Failed to load playlist songs")

    playlist = resolved.get(playlist_id)
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found or not owned by the current user")
    if exclude_playlist_id is not None and exclude_playlist_id not in resolved:
        raise HTTPException(status_code=404, detail="Playlist not found or not owned by the current user")

    affinity = get_affinity(token)

    try:
        exclude_song_ids = None
        if exclude_playlist_id is not None:
            exclude_song_ids = get_playlist_song_ids(token, exclude_playlist_id)
        songs, total = get_playlist_songs_page(
            token,
            playlist_id,
            offset,
            limit,
            sort,
            affinity_tiers=affinity["tiers"],
            exclude_song_ids=exclude_song_ids,
        )
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited reading playlist %s: %s", playlist_id, str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except PermissionError as e:
        logger.warning("Permission denied reading playlist %s: %s", playlist_id, str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        # Includes PlaylistIntegrityError: unlike the multi-playlist index
        # build (which must fail the whole build rather than silently skip
        # one broken playlist), this endpoint reads exactly one playlist —
        # reporting it as an ordinary load failure is the correct, and
        # only, outcome here.
        logger.error("Failed to read playlist %s songs: %s", playlist_id, str(e))
        raise HTTPException(status_code=502, detail="Failed to load playlist songs")

    return {
        "playlist": {"id": playlist["id"], "name": playlist["name"]},
        "songs": songs,
        "total": total,
        "affinity": {"available": affinity["available"], "reason": affinity["reason"]},
    }


@router.delete("/{playlist_id}/songs")
def delete_playlist_song(playlist_id: str, remove_song_data: RemoveSongData):
    '''
    Remove a song from a playlist.
    Args:
        playlist_id (str): Spotify playlist ID
        remove_song_data (RemoveSongData): Song to remove
    Returns:
        dict: Success message
        {
            "message": str
        }
    '''
    token = get_valid_token()
    song_id = remove_song_data.songId
    try:
        remove_song_from_playlist(token, playlist_id, song_id)
    except SpotifyRateLimitedError as e:
        logger.warning("Rate limited removing song %s from playlist %s: %s", song_id, playlist_id, str(e))
        raise HTTPException(status_code=429, detail=RATE_LIMIT_DETAIL)
    except PermissionError as e:
        logger.warning("Permission denied removing song %s from playlist %s: %s", song_id, playlist_id, str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Failed to remove song %s from playlist %s: %s", song_id, playlist_id, str(e))
        raise HTTPException(status_code=502, detail="Failed to remove song from playlist")

    # Removal can make a liked song uncategorized again; reconsider the
    # index in the background rather than blocking this response on a
    # rebuild. The playlist's own song cache is invalidated so the next
    # read of it reflects the removal immediately rather than waiting out
    # its freshness window.
    invalidate_playlist_cache(playlist_id)
    mark_index_stale()

    return {"message": "Song removed from playlist successfully!"}
