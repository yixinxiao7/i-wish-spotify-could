import json

from app.routers import playlists


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
    with open("all_uncategorized_songs.json", "w", encoding="utf-8") as f:
        f.write(json.dumps([{"id": "s1"}, {"id": "s2"}]))

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

    with open("all_uncategorized_songs.json", "r", encoding="utf-8") as f:
        remaining = json.loads(f.read())
    assert remaining == [{"id": "s2"}]


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
