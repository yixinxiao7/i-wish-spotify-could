import json
import os

PINS_PATH = "pinned_playlists.json"


def read_pins() -> set:
    '''
    Read the set of pinned playlist IDs from local state.
    Returns:
        set: Pinned playlist IDs, or an empty set if the file is missing,
             empty, or not valid JSON.
    '''
    if not os.path.exists(PINS_PATH):
        return set()
    try:
        with open(PINS_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        if not content.strip():
            return set()
        data = json.loads(content)
    except json.JSONDecodeError:
        return set()
    return set(data)


def write_pins(pinned_ids: set) -> None:
    '''
    Persist the set of pinned playlist IDs to local state.
    Args:
        pinned_ids (set): Pinned playlist IDs
    Returns:
        None
    '''
    with open(PINS_PATH, "w", encoding="utf-8") as f:
        f.write(json.dumps(list(pinned_ids)))


def set_pin(playlist_id: str, pinned: bool) -> set:
    '''
    Pin or unpin a single playlist. Idempotent in both directions.
    Args:
        playlist_id (str): Spotify playlist ID
        pinned (bool): Desired pin state
    Returns:
        set: The updated pinned playlist IDs
    '''
    pinned_ids = read_pins()
    if pinned:
        pinned_ids.add(playlist_id)
    else:
        pinned_ids.discard(playlist_id)
    write_pins(pinned_ids)
    return pinned_ids


def apply_pins(playlists: list, pinned_ids: set) -> list:
    '''
    Annotate playlists with pin state and order them pinned-first, preserving
    relative order within each group. Pinned IDs with no matching playlist
    are ignored.
    Args:
        playlists (list): Playlists to annotate and order
        pinned_ids (set): Pinned playlist IDs
    Returns:
        list: Playlists in pinned-first order, each with a "pinned" key
    '''
    pinned = []
    unpinned = []
    for playlist in playlists:
        annotated = {**playlist, "pinned": playlist["id"] in pinned_ids}
        if annotated["pinned"]:
            pinned.append(annotated)
        else:
            unpinned.append(annotated)
    return pinned + unpinned


__all__ = ["read_pins", "write_pins", "set_pin", "apply_pins"]
