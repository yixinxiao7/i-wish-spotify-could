import json
import time

from app.routers import playlists
from app.services import songs_service
from app.services.http_client import SpotifyRateLimitedError


def test_get_playlists(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(
        playlists,
        "get_created_playlists",
        lambda token: [{"id": "p1", "name": "Mine"}],
    )
    response = client.get("/api/playlists/")
    assert response.status_code == 200
    assert response.json() == {"playlists": [{"id": "p1", "name": "Mine", "pinned": False}]}


def test_get_playlists_returns_pinned_first(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(
        playlists,
        "get_created_playlists",
        lambda token: [
            {"id": "p1", "name": "A"},
            {"id": "p2", "name": "B"},
            {"id": "p3", "name": "C"},
        ],
    )
    client.post("/api/playlists/pin", json={"playlistId": "p3", "pinned": True})

    response = client.get("/api/playlists/")
    assert response.status_code == 200
    body = response.json()["playlists"]
    assert [p["id"] for p in body] == ["p3", "p1", "p2"]
    assert [p["pinned"] for p in body] == [True, False, False]


def test_get_pins_empty(client):
    response = client.get("/api/playlists/pins")
    assert response.status_code == 200
    assert response.json() == {"pinnedIds": []}


def test_get_pins_populated(client):
    client.post("/api/playlists/pin", json={"playlistId": "p1", "pinned": True})
    response = client.get("/api/playlists/pins")
    assert response.status_code == 200
    assert response.json() == {"pinnedIds": ["p1"]}


def test_post_pin_pins_a_playlist(client):
    response = client.post("/api/playlists/pin", json={"playlistId": "p1", "pinned": True})
    assert response.status_code == 200
    assert response.json() == {"pinnedIds": ["p1"]}


def test_post_pin_unpins_a_playlist(client):
    client.post("/api/playlists/pin", json={"playlistId": "p1", "pinned": True})
    response = client.post("/api/playlists/pin", json={"playlistId": "p1", "pinned": False})
    assert response.status_code == 200
    assert response.json() == {"pinnedIds": []}


def test_post_pin_is_idempotent(client):
    client.post("/api/playlists/pin", json={"playlistId": "p1", "pinned": True})
    response = client.post("/api/playlists/pin", json={"playlistId": "p1", "pinned": True})
    assert response.status_code == 200
    assert response.json() == {"pinnedIds": ["p1"]}


def test_post_pin_missing_playlist_id_is_rejected(client):
    response = client.post("/api/playlists/pin", json={"pinned": True})
    assert response.status_code == 422


def test_post_pin_empty_playlist_id_is_rejected(client):
    response = client.post("/api/playlists/pin", json={"playlistId": "", "pinned": True})
    assert response.status_code == 422


def test_post_song_to_playlists_updates_cache(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    captured = {}

    def fake_add(token, song_id, playlist_ids):
        captured["token"] = token
        captured["song_id"] = song_id
        captured["playlist_ids"] = playlist_ids

    monkeypatch.setattr(playlists, "add_song_to_playlists", fake_add)
    built_at = time.time()
    songs_service._write_index_file([{"id": "s1"}, {"id": "s2"}], built_at)

    response = client.post(
        "/api/playlists/add-song",
        json={"songId": "s1", "playlistIds": ["p1", "p2"]},
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Song added to playlists successfully!"}
    assert captured == {
        "token": "token",
        "song_id": "s1",
        "playlist_ids": ["p1", "p2"],
    }

    remaining_built_at, remaining_songs = songs_service._get_cached_index()
    assert remaining_songs == [{"id": "s2"}]
    assert remaining_built_at == built_at  # filing a song is a correction, not a rebuild


def test_post_song_to_playlists_without_cache_file(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(playlists, "add_song_to_playlists", lambda *args, **kwargs: None)

    response = client.post(
        "/api/playlists/add-song",
        json={"songId": "s1", "playlistIds": ["p1"]},
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Song added to playlists successfully!"}


def test_post_song_to_playlists_error_returns_500(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(*args, **kwargs):
        raise RuntimeError("failed")

    monkeypatch.setattr(playlists, "add_song_to_playlists", boom)

    response = client.post(
        "/api/playlists/add-song",
        json={"songId": "s1", "playlistIds": ["p1"]},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to add song to playlists"


def test_post_song_to_playlists_validation(client):
    response = client.post("/api/playlists/add-song", json={"songId": "s1"})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/playlists/{playlist_id}/songs
# ---------------------------------------------------------------------------


def _stub_owned_playlists(monkeypatch, playlists_list):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(playlists, "get_created_playlists", lambda token: playlists_list)


def test_get_playlist_songs_happy_path(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    monkeypatch.setattr(
        playlists,
        "get_affinity",
        lambda token: {"available": True, "reason": None, "tiers": {"a": 3}},
    )
    monkeypatch.setattr(
        playlists,
        "get_playlist_songs_page",
        lambda token, playlist_id, offset, limit, sort, affinity_tiers=None, exclude_song_ids=None: (
            [{"id": "a", "name": "A", "artists": "", "album": "", "album_pic_url": None, "added_at": "x"}],
            1,
        ),
    )

    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 200
    body = response.json()
    assert body["playlist"] == {"id": "p1", "name": "Mine"}
    assert body["total"] == 1
    assert body["songs"][0]["id"] == "a"
    assert body["affinity"] == {"available": True, "reason": None}


def test_get_playlist_songs_unknown_playlist_returns_404(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "other", "name": "Other"}])
    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 404


def test_get_playlist_songs_not_owned_returns_404(client, monkeypatch):
    # get_created_playlists only ever returns owned playlists, so a
    # followed-but-not-owned playlist simply never appears in the list.
    _stub_owned_playlists(monkeypatch, [])
    response = client.get("/api/playlists/not-owned/songs")
    assert response.status_code == 404


def test_get_playlist_songs_unknown_sort_returns_400(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    response = client.get("/api/playlists/p1/songs?sort=bogus")
    assert response.status_code == 400


def test_get_playlist_songs_affinity_unavailable_is_surfaced(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    monkeypatch.setattr(
        playlists, "get_affinity", lambda token: {"available": False, "reason": "missing_scope", "tiers": None}
    )
    monkeypatch.setattr(
        playlists,
        "get_playlist_songs_page",
        lambda token, playlist_id, offset, limit, sort, affinity_tiers=None, exclude_song_ids=None: ([], 0),
    )
    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 200
    assert response.json()["affinity"] == {"available": False, "reason": "missing_scope"}


def test_get_playlist_songs_permission_error_returns_403(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})

    def boom(*a, **k):
        raise PermissionError("nope")

    monkeypatch.setattr(playlists, "get_playlist_songs_page", boom)
    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 403


def test_get_playlists_rate_limited_returns_429_with_a_clear_message(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(token):
        raise SpotifyRateLimitedError(3858)

    monkeypatch.setattr(playlists, "get_created_playlists", boom)
    response = client.get("/api/playlists/")
    assert response.status_code == 429
    assert "rate limiting" in response.json()["detail"]


def test_get_playlists_other_failure_returns_502_not_bare_500(client, monkeypatch):
    # A bare 500 is what CORSMiddleware fails to annotate, making the browser
    # report a CORS violation instead of the real failure.
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(token):
        raise RuntimeError("spotify down")

    monkeypatch.setattr(playlists, "get_created_playlists", boom)
    assert client.get("/api/playlists/").status_code == 502


def test_get_playlist_songs_rate_limited_returns_429(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(token):
        raise SpotifyRateLimitedError(3858)

    monkeypatch.setattr(playlists, "get_created_playlists", boom)
    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 429


def test_delete_playlist_song_rate_limited_returns_429(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(*a, **k):
        raise SpotifyRateLimitedError(60)

    monkeypatch.setattr(playlists, "remove_song_from_playlist", boom)
    response = client.request("DELETE", "/api/playlists/p1/songs", json={"songId": "s1"})
    assert response.status_code == 429


def test_add_song_rate_limited_returns_429(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(*a, **k):
        raise SpotifyRateLimitedError(60)

    monkeypatch.setattr(playlists, "add_song_to_playlists", boom)
    response = client.post("/api/playlists/add-song", json={"songId": "s1", "playlistIds": ["p1"]})
    assert response.status_code == 429


def test_get_playlist_songs_lookup_failure_returns_502_not_404(client, monkeypatch):
    # A rate limit (or any other Spotify failure) during the ownership
    # lookup must not be reported as "playlist not found" — that would tell
    # the user their playlist is gone when the real cause is transient.
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(token):
        raise Exception("Error: 429 - rate limited")

    monkeypatch.setattr(playlists, "get_created_playlists", boom)
    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 502


def test_get_playlist_songs_load_failure_returns_502(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})

    def boom(*a, **k):
        raise RuntimeError("spotify down")

    monkeypatch.setattr(playlists, "get_playlist_songs_page", boom)
    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 502


# ---------------------------------------------------------------------------
# DELETE /api/playlists/{playlist_id}/songs
# ---------------------------------------------------------------------------


def test_delete_playlist_song_success_invalidates_caches(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(playlists, "remove_song_from_playlist", lambda token, playlist_id, song_id: None)

    invalidated = []
    monkeypatch.setattr(playlists, "invalidate_playlist_cache", lambda playlist_id: invalidated.append(playlist_id))
    marked_stale = []
    monkeypatch.setattr(playlists, "mark_index_stale", lambda: marked_stale.append(True))

    response = client.request(
        "DELETE", "/api/playlists/p1/songs", json={"songId": "s1"}
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Song removed from playlist successfully!"}
    assert invalidated == ["p1"]
    assert marked_stale == [True]


def test_delete_playlist_song_permission_error_returns_403(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(*a, **k):
        raise PermissionError("nope")

    monkeypatch.setattr(playlists, "remove_song_from_playlist", boom)
    response = client.request("DELETE", "/api/playlists/p1/songs", json={"songId": "s1"})
    assert response.status_code == 403


def test_delete_playlist_song_failure_returns_502(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")

    def boom(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(playlists, "remove_song_from_playlist", boom)
    response = client.request("DELETE", "/api/playlists/p1/songs", json={"songId": "s1"})
    assert response.status_code == 502


def test_delete_playlist_song_validation(client):
    response = client.request("DELETE", "/api/playlists/p1/songs", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/playlists/{playlist_id}/songs — exclude_playlist_id (song propagation)
# ---------------------------------------------------------------------------


def test_get_playlist_songs_exclude_param_absent_is_unchanged(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})

    captured = {}

    def fake_page(token, playlist_id, offset, limit, sort, affinity_tiers=None, exclude_song_ids=None):
        captured["exclude_song_ids"] = exclude_song_ids
        return [], 0

    monkeypatch.setattr(playlists, "get_playlist_songs_page", fake_page)

    response = client.get("/api/playlists/p1/songs")
    assert response.status_code == 200
    assert captured["exclude_song_ids"] is None


def test_get_playlist_songs_exclude_param_applies_exclusion(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Source"}, {"id": "p2", "name": "Dest"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})
    monkeypatch.setattr(playlists, "get_playlist_song_ids", lambda token, playlist_id, executor=None: {"dup1", "dup2"})

    captured = {}

    def fake_page(token, playlist_id, offset, limit, sort, affinity_tiers=None, exclude_song_ids=None):
        captured["exclude_song_ids"] = exclude_song_ids
        return [{"id": "new", "name": "N", "artists": "", "album": "", "album_pic_url": None, "added_at": "x"}], 1

    monkeypatch.setattr(playlists, "get_playlist_songs_page", fake_page)

    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p2")
    assert response.status_code == 200
    body = response.json()
    assert captured["exclude_song_ids"] == {"dup1", "dup2"}
    assert body["total"] == 1
    assert body["songs"][0]["id"] == "new"


def test_get_playlist_songs_self_exclusion_returns_400(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p1")
    assert response.status_code == 400


def test_get_playlist_songs_unknown_excluded_playlist_returns_404(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=not-owned")
    assert response.status_code == 404


def test_get_playlist_songs_not_owned_excluded_playlist_returns_404(client, monkeypatch):
    # p2 exists but is not returned by get_created_playlists (not owned)
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Mine"}])
    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p2")
    assert response.status_code == 404


def test_get_playlist_songs_exclusion_resolves_both_playlists_in_one_call(client, monkeypatch):
    calls = []

    def fake_get_created(token):
        calls.append(1)
        return [{"id": "p1", "name": "Source"}, {"id": "p2", "name": "Dest"}]

    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(playlists, "get_created_playlists", fake_get_created)
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})
    monkeypatch.setattr(playlists, "get_playlist_song_ids", lambda token, playlist_id, executor=None: set())
    monkeypatch.setattr(
        playlists,
        "get_playlist_songs_page",
        lambda token, playlist_id, offset, limit, sort, affinity_tiers=None, exclude_song_ids=None: ([], 0),
    )

    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p2")
    assert response.status_code == 200
    assert len(calls) == 1


def test_get_playlist_songs_exclusion_rate_limited_returns_429(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Source"}, {"id": "p2", "name": "Dest"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})

    def boom(token, playlist_id, executor=None):
        raise SpotifyRateLimitedError(60)

    monkeypatch.setattr(playlists, "get_playlist_song_ids", boom)
    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p2")
    assert response.status_code == 429


def test_get_playlist_songs_exclusion_permission_error_returns_403(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Source"}, {"id": "p2", "name": "Dest"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})

    def boom(token, playlist_id, executor=None):
        raise PermissionError("nope")

    monkeypatch.setattr(playlists, "get_playlist_song_ids", boom)
    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p2")
    assert response.status_code == 403


def test_get_playlist_songs_exclusion_load_failure_returns_502(client, monkeypatch):
    _stub_owned_playlists(monkeypatch, [{"id": "p1", "name": "Source"}, {"id": "p2", "name": "Dest"}])
    monkeypatch.setattr(playlists, "get_affinity", lambda token: {"available": True, "reason": None, "tiers": {}})

    def boom(token, playlist_id, executor=None):
        raise RuntimeError("spotify down")

    monkeypatch.setattr(playlists, "get_playlist_song_ids", boom)
    response = client.get("/api/playlists/p1/songs?exclude_playlist_id=p2")
    assert response.status_code == 502


# ---------------------------------------------------------------------------
# POST /api/playlists/add-song — cache invalidation for song propagation
# ---------------------------------------------------------------------------


def test_post_song_to_playlists_invalidates_each_target_playlist_cache(client, monkeypatch):
    monkeypatch.setattr(playlists, "get_valid_token", lambda: "token")
    monkeypatch.setattr(playlists, "add_song_to_playlists", lambda token, song_id, playlist_ids: None)

    invalidated = []
    monkeypatch.setattr(playlists, "invalidate_playlist_cache", lambda playlist_id: invalidated.append(playlist_id))

    response = client.post(
        "/api/playlists/add-song",
        json={"songId": "s1", "playlistIds": ["p1", "p2"]},
    )
    assert response.status_code == 200
    assert invalidated == ["p1", "p2"]
