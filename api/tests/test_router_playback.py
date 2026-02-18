from app.routers import playback


def test_start_playback_success(client, monkeypatch):
    calls = []
    monkeypatch.setattr(playback, "get_valid_token", lambda: "token")
    monkeypatch.setattr(
        playback,
        "toggle_playback",
        lambda token, action, song_id: calls.append((token, action, song_id)),
    )

    response = client.put("/api/playback/start", json={"songId": "song-1"})
    assert response.status_code == 200
    assert response.json() == {"message": "Playback started successfully"}
    assert calls == [("token", "play", "song-1")]


def test_stop_playback_success(client, monkeypatch):
    calls = []
    monkeypatch.setattr(playback, "get_valid_token", lambda: "token")
    monkeypatch.setattr(
        playback,
        "toggle_playback",
        lambda token, action, song_id: calls.append((token, action, song_id)),
    )

    response = client.put("/api/playback/stop", json={"songId": "song-1"})
    assert response.status_code == 200
    assert response.json() == {"message": "Playback stopped successfully"}
    assert calls == [("token", "pause", "song-1")]


def test_start_playback_error_branch(client, monkeypatch):
    monkeypatch.setattr(playback, "get_valid_token", lambda: "token")

    def boom(*args, **kwargs):
        raise RuntimeError("device missing")

    monkeypatch.setattr(playback, "toggle_playback", boom)
    response = client.put("/api/playback/start", json={"songId": "song-1"})
    assert response.status_code == 200
    assert "Error starting playback" in response.text


def test_stop_playback_error_branch(client, monkeypatch):
    monkeypatch.setattr(playback, "get_valid_token", lambda: "token")

    def boom(*args, **kwargs):
        raise RuntimeError("device missing")

    monkeypatch.setattr(playback, "toggle_playback", boom)
    response = client.put("/api/playback/stop", json={"songId": "song-1"})
    assert response.status_code == 200
    assert "Error stopping playback" in response.text
