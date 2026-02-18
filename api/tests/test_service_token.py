import json

import pytest

from app.services import token_service


class DummyResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


def test_get_valid_token_returns_existing_token(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    token_path.write_text(
        json.dumps(
            {
                "access_token": "existing",
                "refresh_token": "refresh",
                "expires_at": 5000,
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(token_service, "TOKEN_PATH", str(token_path))
    monkeypatch.setattr(token_service.time, "time", lambda: 1000)
    monkeypatch.setattr(
        token_service.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not refresh")),
    )

    token = token_service.get_valid_token()
    assert token == "existing"


def test_get_valid_token_refreshes_and_updates_refresh_token(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    token_path.write_text(
        json.dumps(
            {
                "access_token": "old",
                "refresh_token": "old-refresh",
                "expires_at": 1000,
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(token_service, "TOKEN_PATH", str(token_path))
    monkeypatch.setattr(token_service.time, "time", lambda: 980)
    monkeypatch.setattr(
        token_service.requests,
        "post",
        lambda *args, **kwargs: DummyResponse(
            200,
            {
                "access_token": "new",
                "expires_in": 3600,
                "refresh_token": "new-refresh",
            },
        ),
    )

    token = token_service.get_valid_token()
    assert token == "new"
    saved = json.loads(token_path.read_text(encoding="utf-8"))
    assert saved["access_token"] == "new"
    assert saved["refresh_token"] == "new-refresh"
    assert saved["expires_at"] == 4580


def test_get_valid_token_refreshes_without_new_refresh_token(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    token_path.write_text(
        json.dumps(
            {
                "access_token": "old",
                "refresh_token": "old-refresh",
                "expires_at": 1000,
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(token_service, "TOKEN_PATH", str(token_path))
    monkeypatch.setattr(token_service.time, "time", lambda: 980)
    monkeypatch.setattr(
        token_service.requests,
        "post",
        lambda *args, **kwargs: DummyResponse(200, {"access_token": "new", "expires_in": 3600}),
    )

    token = token_service.get_valid_token()
    assert token == "new"
    saved = json.loads(token_path.read_text(encoding="utf-8"))
    assert saved["refresh_token"] == "old-refresh"


def test_get_valid_token_refresh_failure_raises(monkeypatch, tmp_path):
    token_path = tmp_path / "token.json"
    token_path.write_text(
        json.dumps(
            {
                "access_token": "old",
                "refresh_token": "old-refresh",
                "expires_at": 1000,
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(token_service, "TOKEN_PATH", str(token_path))
    monkeypatch.setattr(token_service.time, "time", lambda: 980)
    monkeypatch.setattr(
        token_service.requests,
        "post",
        lambda *args, **kwargs: DummyResponse(401, {"error": "bad"}, text="bad refresh"),
    )

    with pytest.raises(Exception, match="Failed to refresh Spotify token"):
        token_service.get_valid_token()
