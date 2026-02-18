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
