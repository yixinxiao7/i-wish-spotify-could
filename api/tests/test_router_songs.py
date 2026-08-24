from app.routers import songs


def test_get_total_songs(client, monkeypatch):
    monkeypatch.setattr(songs, "get_total_uncategorized_songs", lambda: 123)
    response = client.get("/api/songs/total")
    assert response.status_code == 200
    assert response.json() == {"total": 123}


def test_get_songs_returns_payload(client, monkeypatch):
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")
    monkeypatch.setattr(
        songs,
        "get_uncategorized_songs",
        lambda token, offset, limit: [{"id": "s1", "name": "Song"}],
    )
    response = client.get("/api/songs/?offset=0&limit=10")
    assert response.status_code == 200
    assert response.json() == {"songs": [{"id": "s1", "name": "Song"}]}


def test_get_songs_query_validation(client):
    response = client.get("/api/songs/?offset=-1&limit=0")
    assert response.status_code == 422


def test_post_refresh_songs_rebuilds_and_returns_total(client, monkeypatch):
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")
    captured = {}

    def fake_force_rebuild(token):
        captured["token"] = token
        return 42

    monkeypatch.setattr(songs, "force_rebuild", fake_force_rebuild)
    response = client.post("/api/songs/refresh")
    assert response.status_code == 200
    assert response.json() == {"total": 42}
    assert captured == {"token": "token"}


def test_post_refresh_songs_rebuilds_even_when_index_is_fresh(client, monkeypatch):
    # The router has no notion of freshness at all — it always calls
    # force_rebuild, which is what makes the rebuild unconditional.
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")
    monkeypatch.setattr(songs, "force_rebuild", lambda token: 7)
    response = client.post("/api/songs/refresh")
    assert response.status_code == 200
    assert response.json() == {"total": 7}


def test_post_refresh_songs_failure_returns_error_status(client, monkeypatch):
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")

    def boom(token):
        raise Exception("spotify down")

    monkeypatch.setattr(songs, "force_rebuild", boom)
    response = client.post("/api/songs/refresh")
    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to refresh uncategorized songs."
