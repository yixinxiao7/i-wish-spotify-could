import json
import os
import threading
import time

import pytest

from app.services import affinity_service


class DummyResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = ""

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _reset_affinity_service_state():
    affinity_service._current_build = None
    yield
    affinity_service._current_build = None


@pytest.fixture(autouse=True)
def _granted_scope(monkeypatch):
    # Default every test to having the scope; individual tests override.
    monkeypatch.setattr(affinity_service, "get_granted_scopes", lambda: {"user-top-read"})


def _top_tracks_response(ids):
    return DummyResponse(200, {"items": [{"id": tid} for tid in ids]})


def _fake_get_factory(short=(), medium=(), long=()):
    ranges = {"short_term": short, "medium_term": medium, "long_term": long}

    def fake_get(url, **kwargs):
        for time_range, ids in ranges.items():
            if f"time_range={time_range}" in url:
                return _top_tracks_response(ids)
        raise AssertionError(f"unexpected url: {url}")

    return fake_get


# ---------------------------------------------------------------------------
# Tier assignment
# ---------------------------------------------------------------------------


def test_track_in_all_three_ranges_gets_tier_3(monkeypatch):
    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory(short=["t1"], medium=["t1"], long=["t1"]))
    result = affinity_service.get_affinity("token")
    assert result["available"] is True
    assert affinity_service.get_tier(result["tiers"], "t1") == 3


def test_track_only_in_long_term_gets_tier_1(monkeypatch):
    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory(long=["t1"]))
    result = affinity_service.get_affinity("token")
    assert affinity_service.get_tier(result["tiers"], "t1") == 1


def test_track_only_in_medium_term_gets_tier_2(monkeypatch):
    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory(medium=["t1"]))
    result = affinity_service.get_affinity("token")
    assert affinity_service.get_tier(result["tiers"], "t1") == 2


def test_track_in_no_range_gets_tier_0(monkeypatch):
    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory())
    result = affinity_service.get_affinity("token")
    assert affinity_service.get_tier(result["tiers"], "unknown-track") == 0


def test_unknown_track_id_reports_tier_0_without_error():
    assert affinity_service.get_tier({"t1": 3}, "never-seen") == 0


# ---------------------------------------------------------------------------
# Caching and freshness
# ---------------------------------------------------------------------------


def test_second_lookup_within_freshness_window_issues_no_requests(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return _fake_get_factory(short=["t1"])(url)

    monkeypatch.setattr(affinity_service, "spotify_get", fake_get)
    affinity_service.get_affinity("token")
    calls_after_first = len(calls)
    affinity_service.get_affinity("token")
    assert len(calls) == calls_after_first


def test_stale_cache_triggers_a_refresh(monkeypatch):
    stale_built_at = time.time() - affinity_service._FRESHNESS_WINDOW_SECONDS - 1
    affinity_service._write_cache_file({"old": 1}, stale_built_at)

    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory(short=["new"]))
    result = affinity_service.get_affinity("token")
    assert affinity_service.get_tier(result["tiers"], "new") == 3
    assert affinity_service.get_tier(result["tiers"], "old") == 0


def test_two_concurrent_cold_lookups_produce_exactly_one_build(monkeypatch):
    calls = []
    started = threading.Event()
    proceed = threading.Event()

    def fake_perform_build(token):
        calls.append(token)
        started.set()
        proceed.wait(2)
        affinity_service._write_cache_file({"t1": 3}, time.time())
        return {"t1": 3}

    monkeypatch.setattr(affinity_service, "_perform_build", fake_perform_build)

    results = []

    def worker():
        results.append(affinity_service.get_affinity("token"))

    t1 = threading.Thread(target=worker)
    t1.start()
    assert started.wait(2)

    t2_entered = threading.Event()

    def worker2():
        t2_entered.set()
        results.append(affinity_service.get_affinity("token"))

    t2 = threading.Thread(target=worker2)
    t2.start()
    assert t2_entered.wait(2)
    time.sleep(0.02)

    proceed.set()
    t1.join(2)
    t2.join(2)

    assert calls == ["token"]
    assert results[0]["tiers"] == results[1]["tiers"] == {"t1": 3}


def test_corrupt_envelope_rebuilds_rather_than_raising(monkeypatch):
    with open(affinity_service._CACHE_PATH, "w") as f:
        f.write("{not valid json")
    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory(short=["t1"]))
    result = affinity_service.get_affinity("token")
    assert result["available"] is True
    assert affinity_service.get_tier(result["tiers"], "t1") == 3


def test_version_mismatch_rebuilds_rather_than_raising(monkeypatch):
    with open(affinity_service._CACHE_PATH, "w") as f:
        json.dump({"version": 999, "built_at": time.time(), "tiers": {"old": 1}}, f)
    monkeypatch.setattr(affinity_service, "spotify_get", _fake_get_factory(short=["t1"]))
    result = affinity_service.get_affinity("token")
    assert affinity_service.get_tier(result["tiers"], "t1") == 3


# ---------------------------------------------------------------------------
# Missing scope
# ---------------------------------------------------------------------------


def test_missing_scope_reports_unavailable_with_no_request_issued(monkeypatch):
    monkeypatch.setattr(affinity_service, "get_granted_scopes", lambda: {"user-library-read"})
    monkeypatch.setattr(
        affinity_service, "spotify_get", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no request expected"))
    )
    result = affinity_service.get_affinity("token")
    assert result == {"available": False, "reason": "missing_scope", "tiers": None}


# ---------------------------------------------------------------------------
# Upstream failure
# ---------------------------------------------------------------------------


def test_403_from_top_tracks_reports_unavailable(monkeypatch):
    monkeypatch.setattr(affinity_service, "spotify_get", lambda *a, **k: DummyResponse(403, {"error": "denied"}))
    result = affinity_service.get_affinity("token")
    assert result["available"] is False
    assert result["reason"] == "upstream_error"
    assert result["tiers"] is None


def test_failed_refresh_keeps_previously_cached_map(monkeypatch):
    stale_built_at = time.time() - affinity_service._FRESHNESS_WINDOW_SECONDS - 1
    affinity_service._write_cache_file({"old": 2}, stale_built_at)

    monkeypatch.setattr(affinity_service, "spotify_get", lambda *a, **k: DummyResponse(500, {"error": "boom"}))
    result = affinity_service.get_affinity("token")
    assert result["available"] is True
    assert result["tiers"] == {"old": 2}


def test_upstream_failure_with_no_cache_reports_unavailable_not_raise(monkeypatch):
    monkeypatch.setattr(affinity_service, "spotify_get", lambda *a, **k: DummyResponse(500, {"error": "boom"}))
    result = affinity_service.get_affinity("token")
    assert result == {"available": False, "reason": "upstream_error", "tiers": None}


# ---------------------------------------------------------------------------
# Storage round-trip
# ---------------------------------------------------------------------------


def test_write_then_read_round_trip():
    affinity_service._write_cache_file({"t1": 2}, 1000.0)
    assert affinity_service._get_cached_affinity() == (1000.0, {"t1": 2})


def test_read_from_disk_after_memory_cache_cleared():
    affinity_service._write_cache_file({"t1": 2}, 1000.0)
    # Simulate a fresh process: clear the in-memory cache so the read below
    # exercises the cold file-parse path rather than the memory shortcut.
    affinity_service._memory_cache.update({"abspath": None, "mtime": None, "built_at": None, "tiers": None})
    assert affinity_service._get_cached_affinity() == (1000.0, {"t1": 2})


def test_missing_built_at_is_treated_as_absent():
    with open(affinity_service._CACHE_PATH, "w") as f:
        json.dump({"version": 1, "tiers": {"t1": 1}}, f)
    assert affinity_service._get_cached_affinity() is None


def test_tiers_not_a_dict_is_treated_as_absent():
    with open(affinity_service._CACHE_PATH, "w") as f:
        json.dump({"version": 1, "built_at": 1000.0, "tiers": ["not", "a", "dict"]}, f)
    assert affinity_service._get_cached_affinity() is None


def test_parse_cache_file_returns_none_when_file_unreadable(monkeypatch):
    affinity_service._write_cache_file({"t1": 1}, 1000.0)
    abspath = affinity_service._cache_abspath()

    real_open = open

    def boom_open(path, *args, **kwargs):
        if path == abspath:
            raise OSError("permission denied")
        return real_open(path, *args, **kwargs)

    monkeypatch.setattr(affinity_service, "open", boom_open, raising=False)
    assert affinity_service._parse_cache_file(abspath) is None


def test_write_cache_file_failure_leaves_previous_file_intact(monkeypatch):
    affinity_service._write_cache_file({"t1": 1}, 1000.0)

    def boom_fsync(fd):
        raise OSError("disk full")

    monkeypatch.setattr(affinity_service.os, "fsync", boom_fsync)
    with pytest.raises(OSError):
        affinity_service._write_cache_file({"t1": 2}, 2000.0)

    assert affinity_service._get_cached_affinity() == (1000.0, {"t1": 1})
    leftover_tmp = [
        name for name in os.listdir(".")
        if name.startswith(".track_affinity.") and name.endswith(".tmp")
    ]
    assert leftover_tmp == []


# ---------------------------------------------------------------------------
# _BuildInProgress waiter primitive
# ---------------------------------------------------------------------------


def test_build_in_progress_times_out_if_never_finished():
    build = affinity_service._BuildInProgress()
    with pytest.raises(Exception, match="Timed out waiting"):
        build.wait(0.05)


def test_build_in_progress_propagates_exception_to_waiter():
    build = affinity_service._BuildInProgress()
    err = ValueError("boom")

    def finisher():
        build.finish(exception=err)

    t = threading.Thread(target=finisher)
    t.start()
    t.join()

    with pytest.raises(ValueError, match="boom"):
        build.wait(5)
