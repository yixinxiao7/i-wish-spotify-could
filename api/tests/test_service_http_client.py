import time

import pytest
from tenacity import RetryError

from app.services import http_client


class DummyResponse:
    def __init__(self, status_code, headers=None):
        self.status_code = status_code
        self.headers = headers or {}
        self.text = ""


@pytest.fixture(autouse=True)
def no_real_sleep(monkeypatch):
    # tenacity's synchronous retrying sleeps via the stdlib time module
    # directly; patch it globally so retry tests run instantly.
    monkeypatch.setattr(time, "sleep", lambda *_args, **_kwargs: None)


def test_spotify_get_reuses_shared_session(monkeypatch):
    calls = []
    monkeypatch.setattr(
        http_client._session, "get", lambda *a, **k: calls.append((a, k)) or DummyResponse(200)
    )
    http_client.spotify_get("https://example.com", headers={"A": "1"})
    http_client.spotify_get("https://example.com", headers={"A": "1"})
    assert len(calls) == 2  # same bound method reused, not a new session per call


def test_retry_after_seconds_is_honored(monkeypatch):
    waits = []
    monkeypatch.setattr(
        http_client, "wait_exponential", lambda **k: (lambda rs: (_ for _ in ()).throw(AssertionError("fallback should not be used")))
    )
    responses = [DummyResponse(429, {"Retry-After": "3"}), DummyResponse(200)]

    def fake_get(*_a, **_k):
        return responses.pop(0)

    monkeypatch.setattr(http_client._session, "get", fake_get)
    result = http_client.spotify_get("https://example.com")
    assert result.status_code == 200


def test_retry_after_missing_falls_back_to_exponential(monkeypatch):
    fallback_called = []

    def fake_wait_exponential(**kwargs):
        def wait(retry_state):
            fallback_called.append(True)
            return 0
        return wait

    monkeypatch.setattr(http_client, "wait_exponential", fake_wait_exponential)
    responses = [DummyResponse(429, {}), DummyResponse(200)]

    def fake_get(*_a, **_k):
        return responses.pop(0)

    monkeypatch.setattr(http_client._session, "get", fake_get)
    result = http_client.spotify_get("https://example.com")
    assert result.status_code == 200
    assert fallback_called


def test_retry_after_garbage_falls_back_to_exponential(monkeypatch):
    fallback_called = []

    def fake_wait_exponential(**kwargs):
        def wait(retry_state):
            fallback_called.append(True)
            return 0
        return wait

    monkeypatch.setattr(http_client, "wait_exponential", fake_wait_exponential)
    responses = [DummyResponse(429, {"Retry-After": "not-a-number"}), DummyResponse(200)]

    def fake_get(*_a, **_k):
        return responses.pop(0)

    monkeypatch.setattr(http_client._session, "get", fake_get)
    result = http_client.spotify_get("https://example.com")
    assert result.status_code == 200
    assert fallback_called


def test_retries_stop_after_allowance(monkeypatch):
    calls = []
    monkeypatch.setattr(
        http_client._session,
        "get",
        lambda *a, **k: calls.append(1) or DummyResponse(429, {"Retry-After": "0"}),
    )
    # A result that keeps satisfying retry_if_result (still 429 after every
    # attempt) exhausts stop_after_attempt(4) and surfaces as RetryError —
    # this is tenacity's existing behavior for result-based retries,
    # unchanged by the Retry-After change. The key property under test is
    # that the retry budget is bounded, not unbounded.
    with pytest.raises(RetryError):
        http_client.spotify_get("https://example.com")
    assert len(calls) == 4


def test_spotify_post_also_honors_retry_after(monkeypatch):
    responses = [DummyResponse(429, {"Retry-After": "1"}), DummyResponse(201)]

    def fake_post(*_a, **_k):
        return responses.pop(0)

    monkeypatch.setattr(http_client._session, "post", fake_post)
    result = http_client.spotify_post("https://example.com")
    assert result.status_code == 201


def test_concurrency_ceiling_is_exported():
    assert http_client.CONCURRENCY_CEILING == 8
