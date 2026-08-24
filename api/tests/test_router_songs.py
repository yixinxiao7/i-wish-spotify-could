from app.routers import songs
from app.services.http_client import SpotifyRateLimitedError


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


# ---------------------------------------------------------------------------
# Rate limiting and load failures surface as real statuses, not bare 500s
# ---------------------------------------------------------------------------


def test_get_songs_rate_limited_returns_429(client, monkeypatch):
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")

    def boom(token, offset, limit):
        raise SpotifyRateLimitedError(3858)

    monkeypatch.setattr(songs, "get_uncategorized_songs", boom)
    response = client.get("/api/songs/?offset=0&limit=10")
    assert response.status_code == 429
    assert "rate limiting" in response.json()["detail"]


def test_get_songs_other_failure_returns_502_not_bare_500(client, monkeypatch):
    # The frontend renders its empty state on any failed load, so a bare 500
    # here tells the user their library is empty rather than that it failed.
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")

    def boom(token, offset, limit):
        raise RuntimeError("spotify down")

    monkeypatch.setattr(songs, "get_uncategorized_songs", boom)
    assert client.get("/api/songs/?offset=0&limit=10").status_code == 502


def test_get_total_songs_rate_limited_returns_429(client, monkeypatch):
    def boom():
        raise SpotifyRateLimitedError(3858)

    monkeypatch.setattr(songs, "get_total_uncategorized_songs", boom)
    assert client.get("/api/songs/total").status_code == 429


def test_get_total_songs_other_failure_returns_502(client, monkeypatch):
    def boom():
        raise RuntimeError("timed out")

    monkeypatch.setattr(songs, "get_total_uncategorized_songs", boom)
    assert client.get("/api/songs/total").status_code == 502


def test_refresh_rate_limited_returns_429(client, monkeypatch):
    monkeypatch.setattr(songs, "get_valid_token", lambda: "token")

    def boom(token):
        raise SpotifyRateLimitedError(3858)

    monkeypatch.setattr(songs, "force_rebuild", boom)
    assert client.post("/api/songs/refresh").status_code == 429
