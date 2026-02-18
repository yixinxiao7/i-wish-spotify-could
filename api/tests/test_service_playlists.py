import json

import pytest

from app.services import playlists_service


class DummyResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

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

    def fake_get(url, headers=None, params=None):
        if params["offset"] == 0:
            return DummyResponse(200, {"items": page1_items})
        return DummyResponse(200, {"items": page2_items})

    monkeypatch.setattr(playlists_service.requests, "get", fake_get)
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
        playlists_service.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(
            200,
            {
                "items": [
                    {"id": "p1", "name": "P1", "owner": {"id": "me"}, "images": []},
                    {"id": "p2", "name": "P2", "owner": {"id": "other"}, "images": []},
                ]
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
        playlists_service.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(500, {"error": "bad"}),
    )
    with pytest.raises(Exception, match="Error: 500"):
        playlists_service.get_created_playlists("token")


def test_get_playlist_songs_paginates(monkeypatch):
    first_page = [{"track": {"id": str(i)}} for i in range(100)]
    second_page = [{"track": {"id": "extra"}}]

    def fake_get(url, headers=None, params=None):
        if params["offset"] == 0:
            return DummyResponse(200, {"items": first_page})
        return DummyResponse(200, {"items": second_page})

    monkeypatch.setattr(playlists_service.requests, "get", fake_get)
    songs = playlists_service.get_playlist_songs("token", "playlist-1")
    assert len(songs) == 101


def test_get_playlist_songs_error(monkeypatch):
    monkeypatch.setattr(
        playlists_service.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(400, {"error": "bad"}),
    )
    with pytest.raises(Exception, match="Error: 400"):
        playlists_service.get_playlist_songs("token", "playlist-1")


def test_add_song_to_playlists_success(monkeypatch):
    calls = []

    def fake_post(url, headers=None, json=None):
        calls.append((url, json))
        return DummyResponse(201, {"snapshot_id": "ok"})

    monkeypatch.setattr(playlists_service.requests, "post", fake_post)
    playlists_service.add_song_to_playlists("token", "song-1", ["p1", "p2"])
    assert len(calls) == 2


def test_add_song_to_playlists_raises_on_failure(monkeypatch):
    def fake_post(url, headers=None, json=None):
        if "/p2/" in url:
            return DummyResponse(500, {"error": "bad"})
        return DummyResponse(201, {"snapshot_id": "ok"})

    monkeypatch.setattr(playlists_service.requests, "post", fake_post)
    with pytest.raises(Exception, match="Error adding song to playlist p2"):
        playlists_service.add_song_to_playlists("token", "song-1", ["p1", "p2"])
