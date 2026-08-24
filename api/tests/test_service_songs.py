import json
import os
import threading
import time

import pytest

from app.services import songs_service
from app.services.playlists_service import PlaylistIntegrityError


class DummyResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = ""

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _reset_songs_service_state():
    songs_service._current_cold_build = None
    songs_service._background_refresh_running = False
    yield
    songs_service._current_cold_build = None
    songs_service._background_refresh_running = False


def _liked_item(offset):
    return {
        "track": {
            "id": f"s{offset}",
            "name": "n",
            "artists": [{"name": "a"}],
            "album": {"name": "al", "images": []},
        }
    }


# ---------------------------------------------------------------------------
# get_total_liked_songs / get_liked_songs
# ---------------------------------------------------------------------------


def test_get_total_liked_songs_success(monkeypatch):
    monkeypatch.setattr(songs_service, "spotify_get", lambda *a, **k: DummyResponse(200, {"total": 77}))
    assert songs_service.get_total_liked_songs("token") == 77


def test_get_total_liked_songs_error(monkeypatch):
    monkeypatch.setattr(songs_service, "spotify_get", lambda *a, **k: DummyResponse(403, {"error": "denied"}))
    with pytest.raises(Exception, match="Error: 403"):
        songs_service.get_total_liked_songs("token")


def test_get_liked_songs_error(monkeypatch):
    monkeypatch.setattr(songs_service, "spotify_get", lambda *a, **k: DummyResponse(500, {"error": "bad"}))
    with pytest.raises(Exception, match="Error: 500"):
        songs_service.get_liked_songs("token")


def test_get_liked_songs_ordering_stable_regardless_of_completion_order(monkeypatch):
    def fake_get(url, **kwargs):
        offset = int(url.split("offset=")[1].split("&")[0]) if "offset=" in url else 0
        if offset == 50:
            # Make the middle page resolve last, out of natural order, to
            # prove assembly is keyed by offset rather than completion order.
            time.sleep(0.03)
        return DummyResponse(200, {"total": 150, "items": [_liked_item(offset)]})

    monkeypatch.setattr(songs_service, "spotify_get", fake_get)
    songs = songs_service.get_liked_songs("token")
    assert [s["id"] for s in songs] == ["s0", "s50", "s100"]


def test_get_liked_songs_total_not_divisible_by_page_size_no_dup_no_gap(monkeypatch):
    def fake_get(url, **kwargs):
        offset = int(url.split("offset=")[1].split("&")[0]) if "offset=" in url else 0
        page_size = min(50, 125 - offset)
        items = [_liked_item(offset + i) for i in range(page_size)]
        return DummyResponse(200, {"total": 125, "items": items})

    monkeypatch.setattr(songs_service, "spotify_get", fake_get)
    songs = songs_service.get_liked_songs("token")
    ids = [s["id"] for s in songs]
    assert len(ids) == 125
    assert len(set(ids)) == 125
    assert ids == [f"s{i}" for i in range(125)]


def test_get_liked_songs_single_page_issues_exactly_one_request(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"total": 10, "items": [_liked_item(0)]})

    monkeypatch.setattr(songs_service, "spotify_get", fake_get)
    songs_service.get_liked_songs("token")
    assert len(calls) == 1


def test_get_liked_songs_skips_null_track_entries(monkeypatch):
    monkeypatch.setattr(
        songs_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"total": 2, "items": [{"track": None}, _liked_item(1)]}),
    )
    songs = songs_service.get_liked_songs("token")
    assert [s["id"] for s in songs] == ["s1"]


def test_get_liked_songs_transforms_artists_and_album_art(monkeypatch):
    def fake_get(url, **kwargs):
        return DummyResponse(
            200,
            {
                "total": 1,
                "items": [
                    {
                        "track": {
                            "id": "s1",
                            "name": "Song 1",
                            "artists": [{"name": "A1"}, {"name": "A2"}],
                            "album": {"name": "Album 1", "images": [{"url": "img1"}]},
                        }
                    }
                ],
            },
        )

    monkeypatch.setattr(songs_service, "spotify_get", fake_get)
    songs = songs_service.get_liked_songs("token")
    assert songs[0]["artists"] == "A1, A2"
    assert songs[0]["album_pic_url"] == "img1"


# ---------------------------------------------------------------------------
# Index storage: envelope format, atomic write, in-memory cache
# ---------------------------------------------------------------------------


def test_write_then_read_round_trip():
    songs_service._write_index_file([{"id": "a"}], 1000.0)
    assert songs_service._get_cached_index() == (1000.0, [{"id": "a"}])


def test_legacy_bare_array_format_is_treated_as_absent_and_rebuilt(monkeypatch):
    with open(songs_service._CACHE_PATH, 'w') as f:
        f.write(json.dumps([{"id": "legacy"}]))
    monkeypatch.setattr(songs_service, "_build_index_songs", lambda token: [{"id": "rebuilt"}])

    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "rebuilt"}]

    with open(songs_service._CACHE_PATH) as f:
        data = json.loads(f.read())
    assert data["version"] == 2
    assert data["songs"] == [{"id": "rebuilt"}]


def test_corrupt_json_is_treated_as_absent_and_rebuilt(monkeypatch):
    with open(songs_service._CACHE_PATH, 'w') as f:
        f.write("{not valid json")
    monkeypatch.setattr(songs_service, "_build_index_songs", lambda token: [{"id": "rebuilt"}])

    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "rebuilt"}]


def test_missing_built_at_is_treated_as_absent_and_rebuilt(monkeypatch):
    with open(songs_service._CACHE_PATH, 'w') as f:
        f.write(json.dumps({"version": 2, "songs": [{"id": "x"}]}))
    monkeypatch.setattr(songs_service, "_build_index_songs", lambda token: [{"id": "rebuilt"}])

    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "rebuilt"}]


def test_offset_past_end_returns_empty_list():
    songs_service._write_index_file([{"id": "a"}], time.time())
    songs = songs_service.get_uncategorized_songs("token", offset=100, limit=10)
    assert songs == []


def test_page_turns_reuse_in_memory_cache_after_first_parse(monkeypatch):
    songs_service._write_index_file([{"id": str(i)} for i in range(5)], time.time())
    # Simulate a fresh process: the in-memory cache from the write above
    # would normally already be warm, so clear it to test the read path.
    songs_service._memory_cache.update({"abspath": None, "mtime": None, "built_at": None, "songs": None})

    calls = []
    real_parse = songs_service._parse_index_file

    def spy_parse(abspath):
        calls.append(abspath)
        return real_parse(abspath)

    monkeypatch.setattr(songs_service, "_parse_index_file", spy_parse)

    songs_service.get_uncategorized_songs("token", 0, 2)
    songs_service.get_uncategorized_songs("token", 2, 2)
    songs_service.get_uncategorized_songs("token", 4, 2)
    assert len(calls) == 1


def test_external_write_invalidates_in_memory_cache():
    songs_service._write_index_file([{"id": "a"}], time.time())
    songs1 = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs1 == [{"id": "a"}]

    abspath = songs_service._index_abspath()
    stat_before = os.stat(abspath)
    with open(abspath, 'w') as f:
        f.write(json.dumps({"version": 2, "built_at": time.time(), "songs": [{"id": "b"}]}))
    # Force a distinct mtime deterministically rather than sleeping to wait
    # out filesystem mtime resolution.
    os.utime(abspath, (stat_before.st_mtime + 10, stat_before.st_mtime + 10))

    songs2 = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs2 == [{"id": "b"}]


def test_write_index_file_failure_before_replace_leaves_previous_file_intact(monkeypatch):
    songs_service._write_index_file([{"id": "old"}], 1000.0)

    def boom_fsync(fd):
        raise OSError("disk full")

    monkeypatch.setattr(songs_service.os, "fsync", boom_fsync)
    with pytest.raises(OSError):
        songs_service._write_index_file([{"id": "new"}], 2000.0)

    assert songs_service._get_cached_index() == (1000.0, [{"id": "old"}])
    leftover_tmp = [
        name for name in os.listdir('.')
        if name.startswith('.all_uncategorized_songs.') and name.endswith('.tmp')
    ]
    assert leftover_tmp == []


def test_write_index_file_failure_at_replace_leaves_previous_file_intact(monkeypatch):
    songs_service._write_index_file([{"id": "old"}], 1000.0)

    def boom_replace(src, dst):
        raise OSError("disk full")

    monkeypatch.setattr(songs_service.os, "replace", boom_replace)
    with pytest.raises(OSError):
        songs_service._write_index_file([{"id": "new"}], 2000.0)

    assert songs_service._get_cached_index() == (1000.0, [{"id": "old"}])


# ---------------------------------------------------------------------------
# Building the index (playlist skip / integrity guard)
# ---------------------------------------------------------------------------


def test_get_uncategorized_songs_builds_and_writes_cache_end_to_end(monkeypatch):
    liked_songs = [
        {"id": "s1", "name": "Song 1", "artists": "A", "album": "X", "album_pic_url": None},
        {"id": "s2", "name": "Song 2", "artists": "B", "album": "Y", "album_pic_url": None},
    ]
    playlists = [{"id": "p1", "name": "P1"}, {"id": "p2", "name": "P2"}]

    monkeypatch.setattr(songs_service, "get_liked_songs", lambda token, executor=None: liked_songs)
    monkeypatch.setattr(songs_service, "get_created_playlists", lambda token: playlists)
    monkeypatch.setattr(
        songs_service,
        "get_playlist_songs",
        lambda token, playlist_id, executor=None: ["s2"] if playlist_id == "p1" else [],
    )

    songs = songs_service.get_uncategorized_songs("token", offset=0, limit=10)
    assert songs == [liked_songs[0]]

    with open(songs_service._CACHE_PATH) as f:
        saved = json.loads(f.read())
    assert saved["version"] == 2
    assert saved["songs"] == [liked_songs[0]]


def test_build_skips_playlist_that_raises_ordinary_error(monkeypatch):
    liked_songs = [{"id": "s1", "name": "n", "artists": "a", "album": "al", "album_pic_url": None}]
    monkeypatch.setattr(songs_service, "get_liked_songs", lambda token, executor=None: liked_songs)
    monkeypatch.setattr(songs_service, "get_created_playlists", lambda token: [{"id": "p1", "name": "Broken"}])

    def raiser(token, playlist_id, executor=None):
        raise PermissionError("nope")

    monkeypatch.setattr(songs_service, "get_playlist_songs", raiser)
    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == liked_songs


def test_build_fails_loudly_when_integrity_guard_trips(monkeypatch):
    liked_songs = [{"id": "s1", "name": "n", "artists": "a", "album": "al", "album_pic_url": None}]
    monkeypatch.setattr(songs_service, "get_liked_songs", lambda token, executor=None: liked_songs)
    monkeypatch.setattr(songs_service, "get_created_playlists", lambda token: [{"id": "p1", "name": "Broken"}])

    def raiser(token, playlist_id, executor=None):
        raise PlaylistIntegrityError("broken fields expression")

    monkeypatch.setattr(songs_service, "get_playlist_songs", raiser)
    with pytest.raises(PlaylistIntegrityError):
        songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs_service._get_cached_index() is None


def test_every_playlist_failing_still_completes_with_liked_songs(monkeypatch):
    liked_songs = [{"id": "s1", "name": "n", "artists": "a", "album": "al", "album_pic_url": None}]
    monkeypatch.setattr(songs_service, "get_liked_songs", lambda token, executor=None: liked_songs)
    monkeypatch.setattr(
        songs_service,
        "get_created_playlists",
        lambda token: [{"id": "p1", "name": "A"}, {"id": "p2", "name": "B"}],
    )
    monkeypatch.setattr(
        songs_service,
        "get_playlist_songs",
        lambda token, playlist_id, executor=None: (_ for _ in ()).throw(Exception("boom")),
    )
    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == liked_songs


# ---------------------------------------------------------------------------
# _BuildInProgress: event-based waiter release, not polling
# ---------------------------------------------------------------------------


def test_build_in_progress_waiter_released_promptly():
    build = songs_service._BuildInProgress()

    def finisher():
        time.sleep(0.05)
        build.finish(result=["ok"])

    t = threading.Thread(target=finisher)
    start = time.monotonic()
    t.start()
    result = build.wait(5)
    elapsed = time.monotonic() - start
    t.join()

    assert result == ["ok"]
    assert elapsed < 0.5  # released right after finish(), not after a fixed poll interval


def test_build_in_progress_propagates_exception_to_every_waiter():
    build = songs_service._BuildInProgress()
    err = ValueError("boom")

    def finisher():
        build.finish(exception=err)

    t = threading.Thread(target=finisher)
    t.start()
    t.join()

    with pytest.raises(ValueError, match="boom"):
        build.wait(5)
    with pytest.raises(ValueError, match="boom"):
        build.wait(5)


def test_build_in_progress_times_out_if_never_finished():
    build = songs_service._BuildInProgress()
    with pytest.raises(Exception, match="Timed out waiting"):
        build.wait(0.05)


# ---------------------------------------------------------------------------
# Cold-build single-flight coordination
# ---------------------------------------------------------------------------


def test_cold_build_joins_existing_in_progress_build(monkeypatch):
    fake_build = songs_service._BuildInProgress()
    fake_build.finish(result=[{"id": "shared"}])
    songs_service._current_cold_build = fake_build

    monkeypatch.setattr(
        songs_service, "_perform_build", lambda token: (_ for _ in ()).throw(AssertionError("should not build again"))
    )
    result = songs_service._cold_build("token")
    assert result == [{"id": "shared"}]


def test_cold_build_failure_propagates_to_a_joiner(monkeypatch):
    fake_build = songs_service._BuildInProgress()
    fake_build.finish(exception=RuntimeError("boom"))
    songs_service._current_cold_build = fake_build

    monkeypatch.setattr(
        songs_service, "_perform_build", lambda token: (_ for _ in ()).throw(AssertionError("should not build again"))
    )
    with pytest.raises(RuntimeError, match="boom"):
        songs_service._cold_build("token")


def test_cold_build_owner_failure_propagates_and_clears_state(monkeypatch):
    monkeypatch.setattr(songs_service, "_perform_build", lambda token: (_ for _ in ()).throw(RuntimeError("spotify down")))
    with pytest.raises(RuntimeError, match="spotify down"):
        songs_service._cold_build("token")
    assert songs_service._current_cold_build is None


def test_two_concurrent_cold_requests_produce_exactly_one_build(monkeypatch):
    calls = []
    started = threading.Event()
    proceed = threading.Event()

    def fake_perform_build(token):
        calls.append(token)
        started.set()
        proceed.wait(2)
        songs_service._write_index_file([{"id": "s1"}], time.time())
        return [{"id": "s1"}]

    monkeypatch.setattr(songs_service, "_perform_build", fake_perform_build)

    results = []

    def worker():
        results.append(songs_service.get_uncategorized_songs("token", 0, 10))

    t1 = threading.Thread(target=worker)
    t1.start()
    assert started.wait(2)

    t2_entered = threading.Event()

    def worker2():
        t2_entered.set()
        results.append(songs_service.get_uncategorized_songs("token", 0, 10))

    t2 = threading.Thread(target=worker2)
    t2.start()
    assert t2_entered.wait(2)
    time.sleep(0.02)  # small scheduling bias so t2 reaches the join-wait branch before we release the builder

    proceed.set()
    t1.join(2)
    t2.join(2)

    assert calls == ["token"]
    assert results[0] == results[1] == [{"id": "s1"}]


# ---------------------------------------------------------------------------
# Freshness and background refresh
# ---------------------------------------------------------------------------


def test_fresh_index_does_not_trigger_background_refresh(monkeypatch):
    songs_service._write_index_file([{"id": "a"}], time.time())
    monkeypatch.setattr(
        songs_service, "_perform_build", lambda token: (_ for _ in ()).throw(AssertionError("should not refresh"))
    )
    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "a"}]


def test_stale_read_returns_old_index_immediately_and_refresh_lands_for_later_readers(monkeypatch):
    stale_built_at = time.time() - songs_service._FRESHNESS_WINDOW_SECONDS - 1
    songs_service._write_index_file([{"id": "old"}], stale_built_at)

    calls = []

    def fake_perform_build(token):
        calls.append(token)
        songs_service._write_index_file([{"id": "new"}], time.time())
        return [{"id": "new"}]

    monkeypatch.setattr(songs_service, "_perform_build", fake_perform_build)
    # Run the background refresh synchronously and deterministically for
    # this test — the point under test is what get_uncategorized_songs
    # RETURNS (the pre-refresh snapshot), not the threading itself.
    monkeypatch.setattr(songs_service, "_spawn_daemon", lambda target: target())

    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "old"}]
    assert calls == ["token"]

    songs2 = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs2 == [{"id": "new"}]


def test_second_stale_read_during_running_refresh_does_not_start_another(monkeypatch):
    stale_built_at = time.time() - songs_service._FRESHNESS_WINDOW_SECONDS - 1
    songs_service._write_index_file([{"id": "old"}], stale_built_at)

    calls = []
    started = threading.Event()
    release = threading.Event()

    def fake_perform_build(token):
        calls.append(token)
        started.set()
        release.wait(2)
        songs_service._write_index_file([{"id": "new"}], time.time())
        return [{"id": "new"}]

    monkeypatch.setattr(songs_service, "_perform_build", fake_perform_build)

    threads = []

    def spy_spawn(target):
        t = threading.Thread(target=target, daemon=True)
        threads.append(t)
        t.start()
        return t

    monkeypatch.setattr(songs_service, "_spawn_daemon", spy_spawn)

    songs_service.get_uncategorized_songs("token", 0, 10)  # triggers the first background refresh
    assert started.wait(2)

    songs_service.get_uncategorized_songs("token", 0, 10)  # index is still stale on disk; must NOT start a second one

    release.set()
    threads[0].join(2)

    assert calls == ["token"]
    assert len(threads) == 1


def test_failed_background_refresh_leaves_previous_index_readable(monkeypatch):
    stale_built_at = time.time() - songs_service._FRESHNESS_WINDOW_SECONDS - 1
    songs_service._write_index_file([{"id": "old"}], stale_built_at)

    monkeypatch.setattr(songs_service, "_perform_build", lambda token: (_ for _ in ()).throw(Exception("boom")))

    threads = []

    def spy_spawn(target):
        t = threading.Thread(target=target, daemon=True)
        threads.append(t)
        t.start()
        return t

    monkeypatch.setattr(songs_service, "_spawn_daemon", spy_spawn)

    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "old"}]
    threads[0].join(2)

    assert songs_service._background_refresh_running is False
    assert songs_service._get_cached_index() == (stale_built_at, [{"id": "old"}])


def test_force_rebuild_ignores_freshness_and_returns_new_total(monkeypatch):
    songs_service._write_index_file([{"id": "old"}], time.time())  # fresh

    def fake_perform_build(token):
        songs_service._write_index_file([{"id": "a"}, {"id": "b"}], time.time())
        return [{"id": "a"}, {"id": "b"}]

    monkeypatch.setattr(songs_service, "_perform_build", fake_perform_build)
    total = songs_service.force_rebuild("token")
    assert total == 2
    assert songs_service._get_cached_index()[1] == [{"id": "a"}, {"id": "b"}]


def test_force_rebuild_failure_leaves_previous_index_intact(monkeypatch):
    songs_service._write_index_file([{"id": "old"}], time.time())
    monkeypatch.setattr(songs_service, "_perform_build", lambda token: (_ for _ in ()).throw(Exception("boom")))
    with pytest.raises(Exception, match="boom"):
        songs_service.force_rebuild("token")
    assert songs_service._get_cached_index()[1] == [{"id": "old"}]


# ---------------------------------------------------------------------------
# remove_song_from_index
# ---------------------------------------------------------------------------


def test_remove_song_from_index_removes_song_and_preserves_built_at():
    built_at = 12345.0
    songs_service._write_index_file([{"id": "a"}, {"id": "b"}], built_at)
    songs_service.remove_song_from_index("a")
    assert songs_service._get_cached_index() == (built_at, [{"id": "b"}])


def test_remove_song_from_index_is_a_noop_when_no_index_exists():
    songs_service.remove_song_from_index("a")  # must not raise
    assert songs_service._get_cached_index() is None


def test_remove_song_from_index_is_a_noop_when_song_not_present():
    built_at = 999.0
    songs_service._write_index_file([{"id": "a"}], built_at)
    songs_service.remove_song_from_index("does-not-exist")
    assert songs_service._get_cached_index() == (built_at, [{"id": "a"}])


# ---------------------------------------------------------------------------
# mark_index_stale
# ---------------------------------------------------------------------------


def test_mark_index_stale_preserves_songs_and_leaves_index_readable():
    songs_service._write_index_file([{"id": "a"}, {"id": "b"}], time.time())
    songs_service.mark_index_stale()
    built_at, songs = songs_service._get_cached_index()
    assert songs == [{"id": "a"}, {"id": "b"}]
    assert built_at == 0.0


def test_mark_index_stale_causes_next_read_to_serve_stale_and_refresh(monkeypatch):
    songs_service._write_index_file([{"id": "old"}], time.time())
    songs_service.mark_index_stale()

    calls = []

    def fake_perform_build(token):
        calls.append(token)
        songs_service._write_index_file([{"id": "new"}], time.time())
        return [{"id": "new"}]

    monkeypatch.setattr(songs_service, "_perform_build", fake_perform_build)
    monkeypatch.setattr(songs_service, "_spawn_daemon", lambda target: target())

    songs = songs_service.get_uncategorized_songs("token", 0, 10)
    assert songs == [{"id": "old"}]  # served immediately, without blocking
    assert calls == ["token"]


def test_mark_index_stale_is_a_noop_when_no_index_exists():
    songs_service.mark_index_stale()  # must not raise
    assert songs_service._get_cached_index() is None


# ---------------------------------------------------------------------------
# get_total_uncategorized_songs
# ---------------------------------------------------------------------------


def test_get_total_uncategorized_songs_reads_length():
    songs_service._write_index_file([{"id": "s1"}, {"id": "s2"}], time.time())
    assert songs_service.get_total_uncategorized_songs() == 2


def test_get_total_uncategorized_songs_times_out_with_no_build_in_progress(monkeypatch):
    monkeypatch.setattr(songs_service, "_get_cached_index", lambda: None)
    monkeypatch.setattr(songs_service.time, "sleep", lambda *a, **k: None)
    with pytest.raises(Exception, match="Timed out waiting for uncategorized songs cache to be created"):
        songs_service.get_total_uncategorized_songs()


def test_get_total_uncategorized_songs_waits_for_externally_created_cache(monkeypatch):
    # No build in progress and no index yet; something else (e.g. the poll
    # loop's own delay) produces a valid index before the timeout.
    monkeypatch.setattr(songs_service.time, "sleep", lambda *a, **k: songs_service._write_index_file([{"id": "a"}], time.time()))
    total = songs_service.get_total_uncategorized_songs()
    assert total == 1


def test_spawn_daemon_actually_runs_target_in_a_background_thread():
    done = threading.Event()
    thread = songs_service._spawn_daemon(done.set)
    assert done.wait(2)
    assert thread.daemon is True


def test_get_total_uncategorized_songs_waits_on_in_progress_build(monkeypatch):
    build = songs_service._BuildInProgress()
    songs_service._current_cold_build = build
    monkeypatch.setattr(songs_service, "_get_cached_index", lambda: None)

    def finisher():
        build.finish(result=[{"id": "a"}, {"id": "b"}])

    t = threading.Thread(target=finisher)
    t.start()
    total = songs_service.get_total_uncategorized_songs()
    t.join()
    assert total == 2
