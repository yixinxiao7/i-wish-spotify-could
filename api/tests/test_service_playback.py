import pytest

from app.services import playback_services


class DummyResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def test_toggle_playback_success(monkeypatch):
    monkeypatch.setattr(
        playback_services.requests,
        "put",
        lambda *args, **kwargs: DummyResponse(204),
    )
    playback_services.toggle_playback("token", "play", "song-1")


def test_toggle_playback_error(monkeypatch):
    monkeypatch.setattr(
        playback_services.requests,
        "put",
        lambda *args, **kwargs: DummyResponse(404, {"error": "no device"}),
    )
    with pytest.raises(Exception, match="Error toggling playback: 404"):
        playback_services.toggle_playback("token", "pause", "song-1")
