import json

from app.routers import oauth


class DummyResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


def test_set_token_success_writes_token_file(client, monkeypatch):
    monkeypatch.setenv("SPOTIFY_REDIRECT_URIS", "http://localhost:3000/callback")
    monkeypatch.setattr(oauth.time, "time", lambda: 1000)
    monkeypatch.setattr(
        oauth.requests,
        "post",
        lambda *args, **kwargs: DummyResponse(
            200,
            {
                "access_token": "token",
                "refresh_token": "refresh",
                "expires_in": 3600,
            },
        ),
    )

    response = client.post(
        "/api/oauth/",
        json={"code": "auth-code", "redirect_uri": "http://localhost:3000/callback"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "message": "successfully exchanged code for token.",
        "expires_in": 3600,
    }

    with open("token.json", "r", encoding="utf-8") as f:
        saved = json.load(f)
    assert saved["access_token"] == "token"
    assert saved["expires_at"] == 4600


def test_set_token_forwards_submitted_redirect_uri(client, monkeypatch):
    monkeypatch.setenv(
        "SPOTIFY_REDIRECT_URIS",
        "http://localhost:3000/callback,http://127.0.0.1:3000/callback",
    )

    captured_payload = {}

    def fake_post(*args, **kwargs):
        captured_payload.update(kwargs["data"])
        return DummyResponse(
            200,
            {"access_token": "token", "refresh_token": "refresh", "expires_in": 3600},
        )

    monkeypatch.setattr(oauth.requests, "post", fake_post)

    response = client.post(
        "/api/oauth/",
        json={"code": "auth-code", "redirect_uri": "http://127.0.0.1:3000/callback"},
    )
    assert response.status_code == 200
    assert captured_payload["redirect_uri"] == "http://127.0.0.1:3000/callback"


def test_set_token_rejects_redirect_uri_outside_allowlist(client, monkeypatch):
    monkeypatch.setenv("SPOTIFY_REDIRECT_URIS", "http://localhost:3000/callback")

    called = False

    def fake_post(*args, **kwargs):
        nonlocal called
        called = True
        return DummyResponse(200, {})

    monkeypatch.setattr(oauth.requests, "post", fake_post)

    response = client.post(
        "/api/oauth/",
        json={"code": "auth-code", "redirect_uri": "http://evil.example.com/callback"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid redirect_uri"
    assert called is False


def test_get_allowed_redirect_uris_falls_back_to_single_var(monkeypatch):
    monkeypatch.delenv("SPOTIFY_REDIRECT_URIS", raising=False)
    monkeypatch.setattr(oauth, "SPOTIFY_REDIRECT_URI", "http://localhost:3000/callback")
    assert oauth.get_allowed_redirect_uris() == ["http://localhost:3000/callback"]


def test_get_allowed_redirect_uris_strips_whitespace(monkeypatch):
    monkeypatch.setenv(
        "SPOTIFY_REDIRECT_URIS",
        " http://localhost:3000/callback , http://127.0.0.1:3000/callback ",
    )
    assert oauth.get_allowed_redirect_uris() == [
        "http://localhost:3000/callback",
        "http://127.0.0.1:3000/callback",
    ]


def test_get_allowed_redirect_uris_empty_when_both_unset(monkeypatch):
    monkeypatch.delenv("SPOTIFY_REDIRECT_URIS", raising=False)
    monkeypatch.setattr(oauth, "SPOTIFY_REDIRECT_URI", None)
    assert oauth.get_allowed_redirect_uris() == []


def test_set_token_failure_returns_502(client, monkeypatch):
    monkeypatch.setenv("SPOTIFY_REDIRECT_URIS", "http://localhost:3000/callback")
    monkeypatch.setattr(
        oauth.requests,
        "post",
        lambda *args, **kwargs: DummyResponse(400, {"error": "bad"}, text="bad"),
    )

    response = client.post(
        "/api/oauth/",
        json={"code": "auth-code", "redirect_uri": "http://localhost:3000/callback"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to exchange authorization code"


def test_set_token_missing_body_field_returns_422(client):
    response = client.post("/api/oauth/", json={})
    assert response.status_code == 422


def test_set_token_missing_redirect_uri_returns_422(client):
    response = client.post("/api/oauth/", json={"code": "auth-code"})
    assert response.status_code == 422
