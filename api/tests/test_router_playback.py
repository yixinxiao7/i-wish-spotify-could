import pytest

from app.routers import playback
from app.routers.playlists import RATE_LIMIT_DETAIL
from app.services.http_client import SpotifyRateLimitedError
from app.services.playback_services import PlaybackError


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


def fail_with(exc):
    def boom(*args, **kwargs):
        raise exc

    return boom


def call(client, monkeypatch, path, exc):
    monkeypatch.setattr(playback, "get_valid_token", lambda: "token")
    monkeypatch.setattr(playback, "toggle_playback", fail_with(exc))
    return client.put(f"/api/playback/{path}", json={"songId": "song-1"})


NO_DEVICE = "Open Spotify on a device, then try again."
PREMIUM = "Playback control requires Spotify Premium."
REFUSED = "Spotify refused to play this song on your device."
UPSTREAM = "Couldn't reach Spotify playback. Try again."


@pytest.mark.parametrize(
    "exc,status,detail",
    [
        (SpotifyRateLimitedError(30), 429, RATE_LIMIT_DETAIL),
        (PlaybackError(404, "NO_DEVICE", ""), 409, NO_DEVICE),
        (PlaybackError(404, "NO_ACTIVE_DEVICE", ""), 409, NO_DEVICE),
        (PlaybackError(403, "PREMIUM_REQUIRED", ""), 403, PREMIUM),
        (PlaybackError(403, "UNKNOWN", ""), 403, REFUSED),
        (PlaybackError(500, None, ""), 502, UPSTREAM),
        (PlaybackError(404, None, ""), 502, UPSTREAM),
        (RuntimeError("boom"), 502, UPSTREAM),
    ],
)
def test_start_playback_failures_map_to_real_statuses(client, monkeypatch, exc, status, detail):
    response = call(client, monkeypatch, "start", exc)
    assert response.status_code == status
    assert response.json() == {"detail": detail}


def test_stop_playback_failures_map_to_real_statuses(client, monkeypatch):
    response = call(client, monkeypatch, "stop", SpotifyRateLimitedError())
    assert (response.status_code, response.json()["detail"]) == (429, RATE_LIMIT_DETAIL)
    response = call(client, monkeypatch, "stop", PlaybackError(500, None, ""))
    assert (response.status_code, response.json()["detail"]) == (502, UPSTREAM)
    response = call(client, monkeypatch, "stop", RuntimeError("boom"))
    assert (response.status_code, response.json()["detail"]) == (502, UPSTREAM)


def test_stop_premium_required_is_still_reported(client, monkeypatch):
    response = call(client, monkeypatch, "stop", PlaybackError(403, "PREMIUM_REQUIRED", ""))
    assert response.status_code == 403
    assert response.json() == {"detail": PREMIUM}


def test_pause_restriction_is_treated_as_success(client, monkeypatch):
    response = call(
        client, monkeypatch, "stop", PlaybackError(403, "UNKNOWN", "Restriction violated")
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Playback stopped successfully"}


@pytest.mark.parametrize("path", ["start", "stop"])
@pytest.mark.parametrize("exc", [FileNotFoundError("token.json"), RuntimeError("refresh failed")])
def test_token_failure_is_401(client, monkeypatch, path, exc):
    monkeypatch.setattr(playback, "get_valid_token", fail_with(exc))
    toggled = []
    monkeypatch.setattr(playback, "toggle_playback", lambda *a, **k: toggled.append(1))
    response = client.put(f"/api/playback/{path}", json={"songId": "song-1"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Your Spotify session expired. Log in again."}
    assert toggled == []
