import json
import threading
import time

import pytest

from app.services import playlists_service


class DummyResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


def test_get_created_playlists_fetches_paginates_and_caches_user(monkeypatch):
    page1_items = [
        {"id": f"p{i}", "name": f"P{i}", "owner": {"id": "me"}, "images": [{"url": f"img{i}"}]}
        for i in range(50)
    ]
    page2_items = [
        {"id": "p50", "name": "P50", "owner": {"id": "other"}, "images": []},
        {"id": "p51", "name": "P51", "owner": {"id": "me"}, "images": []},
    ]

    def fake_get(url, **kwargs):
        if "offset" not in url or "offset=0" in url:
            return DummyResponse(200, {"items": page1_items, "next": "https://api.spotify.com/v1/me/playlists?offset=50&limit=50"})
        return DummyResponse(200, {"items": page2_items, "next": None})

    monkeypatch.setattr(playlists_service, "spotify_get", fake_get)
    monkeypatch.setattr(playlists_service, "get_current_user_id", lambda token: "me")

    playlists = playlists_service.get_created_playlists("token")
    assert len(playlists) == 51
    assert all(p["owner_id"] == "me" for p in playlists)
    assert playlists[-1]["playlist_image_url"] is None

    with open("user_id.json", "r", encoding="utf-8") as f:
        cached = json.loads(f.read())
    assert cached == {"id": "me"}


def test_get_created_playlists_uses_existing_user_cache(monkeypatch):
    with open("user_id.json", "w", encoding="utf-8") as f:
        f.write(json.dumps({"id": "me"}))

    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *args, **kwargs: DummyResponse(
            200,
            {
                "items": [
                    {"id": "p1", "name": "P1", "owner": {"id": "me"}, "images": []},
                    {"id": "p2", "name": "P2", "owner": {"id": "other"}, "images": []},
                ],
                "next": None,
            },
        ),
    )
    monkeypatch.setattr(
        playlists_service,
        "get_current_user_id",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not be called")),
    )

    playlists = playlists_service.get_created_playlists("token")
    assert playlists == [
        {"id": "p1", "name": "P1", "owner_id": "me", "playlist_image_url": None}
    ]


def test_get_created_playlists_error(monkeypatch):
    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *args, **kwargs: DummyResponse(500, {"error": "bad", "next": None}),
    )
    with pytest.raises(Exception, match="Error: 500"):
        playlists_service.get_created_playlists("token")


def test_get_playlist_songs_filtered_shape_and_single_page(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        assert "fields=items(item(id)),next,total" in url
        return DummyResponse(200, {"items": [{"item": {"id": "a"}}, {"item": {"id": "b"}}], "next": None, "total": 2})

    monkeypatch.setattr(playlists_service, "spotify_get", fake_get)
    ids = playlists_service.get_playlist_songs("token", "playlist-1")
    assert ids == ["a", "b"]
    assert len(calls) == 1


def test_get_playlist_songs_multi_page_collects_every_id_exactly_once(monkeypatch):
    def fake_get(url, **kwargs):
        if "offset=0" in url or "offset" not in url:
            return DummyResponse(
                200,
                {"items": [{"item": {"id": str(i)}} for i in range(100)], "next": "x", "total": 101},
            )
        return DummyResponse(200, {"items": [{"item": {"id": "extra"}}], "next": None, "total": 101})

    monkeypatch.setattr(playlists_service, "spotify_get", fake_get)
    ids = playlists_service.get_playlist_songs("token", "playlist-1")
    assert len(ids) == 101
    assert len(set(ids)) == 101
    assert ids[-1] == "extra"


def test_get_playlist_songs_pages_are_requested_concurrently(monkeypatch):
    # total=300 with a page size of 100 means offsets 100 and 200 are fetched
    # after the first page — both must be in flight at once for this barrier
    # of 2 to release; a serial `next`-following implementation would hang
    # here and hit the barrier's timeout.
    barrier = threading.Barrier(2, timeout=2)

    def fake_get(url, **kwargs):
        if "offset=0" in url or "offset" not in url:
            return DummyResponse(200, {"items": [{"item": {"id": "0"}}], "next": None, "total": 300})
        barrier.wait()
        offset = url.split("offset=")[1].split("&")[0]
        return DummyResponse(200, {"items": [{"item": {"id": offset}}], "next": None, "total": 300})

    monkeypatch.setattr(playlists_service, "spotify_get", fake_get)
    ids = playlists_service.get_playlist_songs("token", "playlist-1")
    assert len(ids) == 3  # offsets 0, 100, 200 -> pages of 1 id each


def test_get_playlist_songs_broken_fields_expression_trips_integrity_guard(monkeypatch):
    # Simulates the silent-failure mode: a wrong `fields` expression (e.g.
    # track(id) instead of item(id)) returns 200 with empty objects instead
    # of an error.
    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [{}, {}, {}], "next": None, "total": 3}),
    )
    with pytest.raises(playlists_service.PlaylistIntegrityError):
        playlists_service.get_playlist_songs("token", "playlist-1")


def test_get_playlist_songs_genuinely_empty_playlist_does_not_trip_guard(monkeypatch):
    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [], "next": None, "total": 0}),
    )
    assert playlists_service.get_playlist_songs("token", "playlist-1") == []


def test_get_playlist_songs_403_raises_permission_error(monkeypatch):
    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(403, text="nope"),
    )
    with pytest.raises(PermissionError):
        playlists_service.get_playlist_songs("token", "playlist-1")


def test_get_playlist_songs_other_error(monkeypatch):
    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *args, **kwargs: DummyResponse(400, {"error": "bad"}),
    )
    with pytest.raises(Exception, match="Error: 400"):
        playlists_service.get_playlist_songs("token", "playlist-1")


def test_get_playlist_songs_uses_provided_executor(monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    monkeypatch.setattr(
        playlists_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [{"item": {"id": "a"}}], "next": None, "total": 1}),
    )
    with ThreadPoolExecutor(max_workers=2) as executor:
        ids = playlists_service.get_playlist_songs("token", "playlist-1", executor)
        assert ids == ["a"]
        # Caller-owned executor must not be torn down by the callee.
        assert executor.submit(lambda: 1).result() == 1


def test_add_song_to_playlists_success(monkeypatch):
    calls = []

    def fake_post(url, headers=None, json=None):
        calls.append((url, json))
        return DummyResponse(201, {"snapshot_id": "ok"})

    monkeypatch.setattr(playlists_service, "spotify_post", fake_post)
    playlists_service.add_song_to_playlists("token", "song-1", ["p1", "p2"])
    assert len(calls) == 2


def test_add_song_to_playlists_raises_on_failure(monkeypatch):
    def fake_post(url, headers=None, json=None):
        if "/p2/" in url:
            return DummyResponse(500, {"error": "bad"})
        return DummyResponse(201, {"snapshot_id": "ok"})

    monkeypatch.setattr(playlists_service, "spotify_post", fake_post)
    with pytest.raises(Exception, match="Error adding song to playlist p2"):
        playlists_service.add_song_to_playlists("token", "song-1", ["p1", "p2"])


def test_add_song_to_playlists_403_raises_permission_error(monkeypatch):
    monkeypatch.setattr(
        playlists_service,
        "spotify_post",
        lambda *a, **k: DummyResponse(403, text="nope"),
    )
    with pytest.raises(PermissionError):
        playlists_service.add_song_to_playlists("token", "song-1", ["p1"])
