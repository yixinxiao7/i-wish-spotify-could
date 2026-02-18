import pytest

from app.services import users_services


class DummyResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def test_get_current_user_id_success(monkeypatch):
    monkeypatch.setattr(
        users_services.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(200, {"id": "user-123"}),
    )
    user_id = users_services.get_current_user_id("token")
    assert user_id == "user-123"


def test_get_current_user_id_error(monkeypatch):
    monkeypatch.setattr(
        users_services.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(500, {"error": "oops"}),
    )
    with pytest.raises(Exception, match="Error: 500"):
        users_services.get_current_user_id("token")
