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
    assert response.json() == {"playlists": [{"id": "p1", "name": "Mine"}]}


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
