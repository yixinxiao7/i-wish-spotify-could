import pytest

from app.services import playback_services
from app.services.http_client import SpotifyRateLimitedError


class DummyResponse:
    def __init__(self, status_code, payload=None, bad_json=False):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self._bad_json = bad_json

    def json(self):
        if self._bad_json:
            raise ValueError("not json")
        return self._payload


def device(id, active=False, restricted=False):
    return {"id": id, "is_active": active, "is_restricted": restricted}


@pytest.fixture
def spotify(monkeypatch):
    '''Record GET/PUT calls; tests set .devices, .put_response and .scopes.'''
    state = type("State", (), {})()
    state.gets, state.puts = [], []
    state.devices = [device("d1", active=True)]
    state.devices_status = 200
    state.put_response = DummyResponse(204)
    monkeypatch.setattr(
        playback_services,
        "get_granted_scopes",
        lambda: {"user-read-playback-state"},
    )

    def fake_get(url, **kwargs):
        state.gets.append((url, kwargs))
        return DummyResponse(state.devices_status, {"devices": state.devices})

    def fake_put(url, **kwargs):
        state.puts.append((url, kwargs))
        return state.put_response

    monkeypatch.setattr(playback_services, "spotify_get", fake_get)
    monkeypatch.setattr(playback_services, "spotify_put", fake_put)
    return state


def test_play_targets_the_active_device(spotify):
    spotify.devices = [device("idle"), device("live", active=True)]
    playback_services.toggle_playback("token", "play", "song-1")
    url, kwargs = spotify.puts[0]
    assert url.endswith("/me/player/play")
    assert kwargs["params"] == {"device_id": "live"}
    assert kwargs["json"] == {"uris": ["spotify:track:song-1"]}
    assert kwargs["headers"] == {"Authorization": "Bearer token"}


def test_restricted_devices_are_skipped(spotify):
    spotify.devices = [device("locked", active=True, restricted=True), device("free")]
    playback_services.toggle_playback("token", "play", "song-1")
    assert spotify.puts[0][1]["params"] == {"device_id": "free"}


def test_first_unrestricted_device_is_the_fallback(spotify):
    spotify.devices = [device("locked", restricted=True), device("a"), device("b")]
    playback_services.toggle_playback("token", "play", "song-1")
    assert spotify.puts[0][1]["params"] == {"device_id": "a"}


def test_no_devices_raises_no_device_without_playing(spotify):
    spotify.devices = []
    with pytest.raises(playback_services.PlaybackError) as excinfo:
        playback_services.toggle_playback("token", "play", "song-1")
    assert excinfo.value.reason == "NO_DEVICE"
    assert spotify.puts == []


def test_only_restricted_devices_raises_no_device(spotify):
    spotify.devices = [device("locked", restricted=True)]
    with pytest.raises(playback_services.PlaybackError) as excinfo:
        playback_services.toggle_playback("token", "play", "song-1")
    assert excinfo.value.reason == "NO_DEVICE"


def test_device_lookup_failure_raises_playback_error(spotify):
    spotify.devices_status = 403
    with pytest.raises(playback_services.PlaybackError) as excinfo:
        playback_services.toggle_playback("token", "play", "song-1")
    assert excinfo.value.status == 403
    assert spotify.puts == []


def test_missing_scope_sends_untargeted_play_without_device_lookup(spotify, monkeypatch):
    monkeypatch.setattr(playback_services, "get_granted_scopes", lambda: set())
    playback_services.toggle_playback("token", "play", "song-1")
    assert spotify.gets == []
    assert "params" not in spotify.puts[0][1]
    assert spotify.puts[0][1]["json"] == {"uris": ["spotify:track:song-1"]}


def test_pause_sends_no_device_lookup_and_no_body(spotify):
    playback_services.toggle_playback("token", "pause", "song-1")
    assert spotify.gets == []
    url, kwargs = spotify.puts[0]
    assert url.endswith("/me/player/pause")
    assert "json" not in kwargs and "params" not in kwargs


@pytest.mark.parametrize("status", [200, 202, 204])
def test_any_2xx_is_success(spotify, status):
    spotify.put_response = DummyResponse(status)
    playback_services.toggle_playback("token", "play", "song-1")


@pytest.mark.parametrize(
    "status,reason",
    [
        (404, "NO_ACTIVE_DEVICE"),
        (403, "PREMIUM_REQUIRED"),
        (403, "UNKNOWN"),
        (500, None),
    ],
)
def test_spotify_errors_raise_playback_error_with_status_and_reason(spotify, status, reason):
    error = {"status": status, "message": "nope"}
    if reason:
        error["reason"] = reason
    spotify.put_response = DummyResponse(status, {"error": error})
    with pytest.raises(playback_services.PlaybackError) as excinfo:
        playback_services.toggle_playback("token", "pause", "song-1")
    assert excinfo.value.status == status
    assert excinfo.value.reason == reason
    assert excinfo.value.message == "nope"


def test_non_json_error_body_is_tolerated(spotify):
    spotify.put_response = DummyResponse(502, bad_json=True)
    with pytest.raises(playback_services.PlaybackError) as excinfo:
        playback_services.toggle_playback("token", "pause", "song-1")
    assert (excinfo.value.status, excinfo.value.reason, excinfo.value.message) == (502, None, "")


def test_string_error_body_becomes_the_message(spotify):
    spotify.put_response = DummyResponse(400, {"error": "bad"})
    with pytest.raises(playback_services.PlaybackError) as excinfo:
        playback_services.toggle_playback("token", "pause", "song-1")
    assert excinfo.value.message == "bad"


def test_rate_limit_propagates_untouched(spotify, monkeypatch):
    def limited(*_a, **_k):
        raise SpotifyRateLimitedError(30)

    monkeypatch.setattr(playback_services, "spotify_put", limited)
    with pytest.raises(SpotifyRateLimitedError):
        playback_services.toggle_playback("token", "pause", "song-1")
