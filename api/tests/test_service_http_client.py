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
    # attempt) exhausts stop_after_attempt(4). Tenacity surfaces that as
    # RetryError, which `_call` now normalizes to SpotifyRateLimitedError so
    # callers have a single rate-limit exception to catch. The key property
    # under test is unchanged: the retry budget is bounded, not unbounded.
    with pytest.raises(http_client.SpotifyRateLimitedError):
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


def test_spotify_delete_also_honors_retry_after(monkeypatch):
    responses = [DummyResponse(429, {"Retry-After": "1"}), DummyResponse(200)]

    def fake_delete(*_a, **_k):
        return responses.pop(0)

    monkeypatch.setattr(http_client._session, "delete", fake_delete)
    result = http_client.spotify_delete("https://example.com")
    assert result.status_code == 200


def test_retry_after_beyond_the_cap_raises_instead_of_waiting(monkeypatch):
    # Spotify's Development Mode quota can answer with a Retry-After of
    # hours. Honoring that verbatim parks the calling thread for that long
    # and the request never returns; the client must give up instead.
    slept = []
    monkeypatch.setattr(time, "sleep", lambda s: slept.append(s))

    calls = []

    def fake_get(*_a, **_k):
        calls.append(1)
        return DummyResponse(429, {"Retry-After": "6493"})

    monkeypatch.setattr(http_client._session, "get", fake_get)

    with pytest.raises(http_client.SpotifyRateLimitedError) as excinfo:
        http_client.spotify_get("https://example.com")
    assert excinfo.value.retry_after == 6493
    assert len(calls) == 1  # no retry attempted
    assert slept == []  # and crucially, nothing slept


def test_rate_limit_that_survives_the_retry_budget_raises(monkeypatch):
    # A short Retry-After is retried, but if every attempt is still 429 the
    # caller must get the typed error rather than a 429 response object it
    # would have to inspect itself.
    monkeypatch.setattr(time, "sleep", lambda *_a: None)
    monkeypatch.setattr(
        http_client._session, "get", lambda *_a, **_k: DummyResponse(429, {"Retry-After": "1"})
    )
    with pytest.raises(http_client.SpotifyRateLimitedError):
        http_client.spotify_get("https://example.com")


def test_rate_limit_error_carries_retry_after_in_its_message():
    err = http_client.SpotifyRateLimitedError(120)
    assert "120" in str(err)
    assert err.retry_after == 120
    assert "Retry-After" not in str(http_client.SpotifyRateLimitedError())


def test_spotify_post_and_delete_also_raise_on_rate_limit(monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda *_a: None)
    monkeypatch.setattr(
        http_client._session, "post", lambda *_a, **_k: DummyResponse(429, {"Retry-After": "9999"})
    )
    monkeypatch.setattr(
        http_client._session, "delete", lambda *_a, **_k: DummyResponse(429, {"Retry-After": "9999"})
    )
    with pytest.raises(http_client.SpotifyRateLimitedError):
        http_client.spotify_post("https://example.com")
    with pytest.raises(http_client.SpotifyRateLimitedError):
        http_client.spotify_delete("https://example.com")


def test_retry_after_at_the_cap_is_still_honored(monkeypatch):
    responses = [
        DummyResponse(429, {"Retry-After": str(http_client.MAX_RETRY_AFTER_SECONDS)}),
        DummyResponse(200),
    ]
    monkeypatch.setattr(http_client._session, "get", lambda *_a, **_k: responses.pop(0))
    result = http_client.spotify_get("https://example.com")
    assert result.status_code == 200


def test_parse_retry_after_handles_absent_and_garbage_headers():
    assert http_client._parse_retry_after(DummyResponse(429, {})) is None
    assert http_client._parse_retry_after(DummyResponse(429, {"Retry-After": "soon"})) is None
    assert http_client._parse_retry_after(DummyResponse(429, {"Retry-After": "-5"})) == 0
    assert http_client._parse_retry_after(DummyResponse(429, {"Retry-After": "12"})) == 12


def test_over_cap_retry_after_still_lets_non_429_responses_through(monkeypatch):
    monkeypatch.setattr(http_client._session, "get", lambda *_a, **_k: DummyResponse(200, {"Retry-After": "9999"}))
    assert http_client.spotify_get("https://example.com").status_code == 200


def test_other_error_statuses_are_returned_not_raised(monkeypatch):
    # Only 429 becomes a typed error; every other status stays a response so
    # each service keeps its own handling (403 -> PermissionError, etc).
    for status in (400, 403, 404, 500, 502):
        monkeypatch.setattr(http_client._session, "get", lambda *_a, s=status, **_k: DummyResponse(s))
        assert http_client.spotify_get("https://example.com").status_code == status


def test_spotify_delete_reuses_shared_session(monkeypatch):
    calls = []
    monkeypatch.setattr(
        http_client._session, "delete", lambda *a, **k: calls.append((a, k)) or DummyResponse(200)
    )
    http_client.spotify_delete("https://example.com")
    http_client.spotify_delete("https://example.com")
    assert len(calls) == 2
