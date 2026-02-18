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

    response = client.post("/api/oauth/", json={"code": "auth-code"})
    assert response.status_code == 200
    assert response.json() == {
        "message": "successfully exchanged code for token.",
        "expires_in": 3600,
    }

    with open("token.json", "r", encoding="utf-8") as f:
        saved = json.load(f)
    assert saved["access_token"] == "token"
    assert saved["expires_at"] == 4600


def test_set_token_failure_returns_502(client, monkeypatch):
    monkeypatch.setattr(
        oauth.requests,
        "post",
        lambda *args, **kwargs: DummyResponse(400, {"error": "bad"}, text="bad"),
    )

    response = client.post("/api/oauth/", json={"code": "auth-code"})
    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to exchange authorization code"


def test_set_token_missing_body_field_returns_422(client):
    response = client.post("/api/oauth/", json={})
    assert response.status_code == 422
