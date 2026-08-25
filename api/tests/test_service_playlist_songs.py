import threading
import time

import pytest

from app.services import playlist_songs_service
from app.services.playlists_service import PlaylistIntegrityError


class DummyResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _reset_cache():
    playlist_songs_service._cache.clear()
    yield
    playlist_songs_service._cache.clear()


def _item(track_id, added_at="2024-01-01T00:00:00Z", name="n", artists=("a",), album="al", images=None):
    return {
        "added_at": added_at,
        "item": {
            "id": track_id,
            "name": name,
            "artists": [{"name": a} for a in artists],
            "album": {"name": album, "images": images or []},
        },
    }


# ---------------------------------------------------------------------------
# fetch_all_playlist_songs
# ---------------------------------------------------------------------------


def test_fetch_all_playlist_songs_single_page_shape(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        assert "fields=items(added_at,item(id,name,artists(name),album(name,images))),next,total" in url
        return DummyResponse(200, {
            "items": [_item("a", added_at="2020-01-01T00:00:00Z", name="A", artists=("Art1",), album="Al1",
                             images=[{"url": "img1"}])],
            "next": None,
            "total": 1,
        })

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    songs = playlist_songs_service.fetch_all_playlist_songs("token", "p1")
    assert songs == [{
        "id": "a",
        "name": "A",
        "artists": "Art1",
        "album": "Al1",
        "album_pic_url": "img1",
        "added_at": "2020-01-01T00:00:00Z",
    }]
    assert len(calls) == 1


def test_fetch_all_playlist_songs_multi_page_collects_every_song_once(monkeypatch):
    def fake_get(url, **kwargs):
        if "offset=0" in url or "offset" not in url:
            return DummyResponse(200, {"items": [_item(str(i)) for i in range(100)], "next": "x", "total": 101})
        return DummyResponse(200, {"items": [_item("extra")], "next": None, "total": 101})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    songs = playlist_songs_service.fetch_all_playlist_songs("token", "p1")
    ids = [s["id"] for s in songs]
    assert len(ids) == 101
    assert len(set(ids)) == 101
    assert ids[-1] == "extra"


def test_fetch_all_playlist_songs_broken_fields_expression_trips_integrity_guard(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [{}, {}], "next": None, "total": 2}),
    )
    with pytest.raises(PlaylistIntegrityError):
        playlist_songs_service.fetch_all_playlist_songs("token", "p1")


def test_fetch_all_playlist_songs_genuinely_empty_playlist_does_not_trip_guard(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [], "next": None, "total": 0}),
    )
    assert playlist_songs_service.fetch_all_playlist_songs("token", "p1") == []


def test_fetch_all_playlist_songs_403_raises_permission_error(monkeypatch):
    monkeypatch.setattr(playlist_songs_service, "spotify_get", lambda *a, **k: DummyResponse(403, text="nope"))
    with pytest.raises(PermissionError):
        playlist_songs_service.fetch_all_playlist_songs("token", "p1")


def test_fetch_all_playlist_songs_other_error(monkeypatch):
    monkeypatch.setattr(playlist_songs_service, "spotify_get", lambda *a, **k: DummyResponse(400, {"error": "bad"}))
    with pytest.raises(Exception, match="Error: 400"):
        playlist_songs_service.fetch_all_playlist_songs("token", "p1")


def test_fetch_all_playlist_songs_skips_null_track_items(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [{"added_at": "x", "item": None}, _item("a")], "next": None, "total": 2}),
    )
    songs = playlist_songs_service.fetch_all_playlist_songs("token", "p1")
    assert [s["id"] for s in songs] == ["a"]


def test_fetch_all_playlist_songs_pages_requested_concurrently(monkeypatch):
    barrier = threading.Barrier(2, timeout=2)

    def fake_get(url, **kwargs):
        if "offset=0" in url or "offset" not in url:
            return DummyResponse(200, {"items": [_item("0")], "next": None, "total": 300})
        barrier.wait()
        offset = url.split("offset=")[1].split("&")[0]
        return DummyResponse(200, {"items": [_item(offset)], "next": None, "total": 300})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    songs = playlist_songs_service.fetch_all_playlist_songs("token", "p1")
    assert len(songs) == 3


# ---------------------------------------------------------------------------
# sort_songs
# ---------------------------------------------------------------------------


def _song(track_id, added_at):
    return {"id": track_id, "name": track_id, "artists": "", "album": "", "album_pic_url": None, "added_at": added_at}


def test_sort_playlist_order_unchanged():
    songs = [_song("b", "2020-01-02"), _song("a", "2020-01-01")]
    assert playlist_songs_service.sort_songs(songs, "playlist") == songs


def test_sort_added_asc():
    songs = [_song("b", "2020-01-02"), _song("a", "2020-01-01")]
    result = playlist_songs_service.sort_songs(songs, "added_asc")
    assert [s["id"] for s in result] == ["a", "b"]


def test_sort_added_desc():
    songs = [_song("a", "2020-01-01"), _song("b", "2020-01-02")]
    result = playlist_songs_service.sort_songs(songs, "added_desc")
    assert [s["id"] for s in result] == ["b", "a"]


def test_sort_affinity_asc_tier_0_first():
    songs = [_song("listened", "2020-01-01"), _song("unlistened", "2020-01-02")]
    result = playlist_songs_service.sort_songs(songs, "affinity_asc", affinity_tiers={"listened": 3})
    assert [s["id"] for s in result] == ["unlistened", "listened"]


def test_sort_affinity_asc_breaks_tie_by_oldest_added_at():
    songs = [_song("newer", "2020-06-01"), _song("older", "2020-01-01")]
    result = playlist_songs_service.sort_songs(songs, "affinity_asc", affinity_tiers={})
    assert [s["id"] for s in result] == ["older", "newer"]


def test_sort_affinity_asc_missing_from_tiers_defaults_to_tier_0():
    songs = [_song("known", "2020-01-01"), _song("unknown", "2020-01-02")]
    result = playlist_songs_service.sort_songs(songs, "affinity_asc", affinity_tiers={"known": 2})
    assert [s["id"] for s in result] == ["unknown", "known"]


def test_sort_is_stable_across_repeated_calls_for_equal_keys():
    songs = [_song("x", "2020-01-01"), _song("y", "2020-01-01"), _song("z", "2020-01-01")]
    result1 = playlist_songs_service.sort_songs(songs, "added_asc")
    result2 = playlist_songs_service.sort_songs(songs, "added_asc")
    assert [s["id"] for s in result1] == [s["id"] for s in result2] == ["x", "y", "z"]


def test_sort_unknown_key_rejected():
    with pytest.raises(ValueError, match="Unknown sort"):
        playlist_songs_service.sort_songs([], "shuffle")


# ---------------------------------------------------------------------------
# get_playlist_songs_page — ordering spans the whole playlist, pagination
# applies after sorting, cache reuse, offset past end
# ---------------------------------------------------------------------------


def test_get_playlist_songs_page_orders_across_whole_playlist_not_just_one_page(monkeypatch):
    def fake_get(url, **kwargs):
        if "offset=0" in url or "offset" not in url:
            items = [_item(f"s{i}", added_at=f"2020-01-{100-i:02d}") for i in range(100)]
            return DummyResponse(200, {"items": items, "next": "x", "total": 101})
        return DummyResponse(200, {"items": [_item("oldest", added_at="1999-01-01")], "next": None, "total": 101})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    page, total = playlist_songs_service.get_playlist_songs_page("token", "p1", offset=0, limit=1, sort="added_asc")
    assert total == 101
    assert page[0]["id"] == "oldest"


def test_get_playlist_songs_page_unknown_sort_rejected_before_fetch(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service, "spotify_get", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no fetch expected"))
    )
    with pytest.raises(ValueError):
        playlist_songs_service.get_playlist_songs_page("token", "p1", offset=0, limit=10, sort="bogus")


def test_get_playlist_songs_page_offset_past_end_returns_empty():
    playlist_songs_service._set_cached_songs("p1", [_song("a", "2020-01-01")])
    page, total = playlist_songs_service.get_playlist_songs_page("token", "p1", offset=10, limit=10, sort="playlist")
    assert page == []
    assert total == 1


def test_get_playlist_songs_page_reuses_cache_within_freshness_window(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"items": [_item("a")], "next": None, "total": 1})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    assert len(calls) == 1


def test_get_playlist_songs_page_refetches_after_cache_invalidated(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"items": [_item("a")], "next": None, "total": 1})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    playlist_songs_service.invalidate_playlist_cache("p1")
    playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    assert len(calls) == 2


def test_get_playlist_songs_page_refetches_after_cache_stale(monkeypatch):
    playlist_songs_service._cache["p1"] = (
        time.time() - playlist_songs_service._CACHE_FRESHNESS_SECONDS - 1,
        [_song("stale", "2020-01-01")],
    )
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"items": [_item("fresh")], "next": None, "total": 1})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    page, _ = playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    assert len(calls) == 1
    assert page[0]["id"] == "fresh"


def test_invalidate_playlist_cache_is_a_noop_for_unknown_playlist():
    playlist_songs_service.invalidate_playlist_cache("never-cached")  # must not raise


def test_get_playlist_songs_page_attaches_affinity_tier_per_song(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [_item("known"), _item("unknown")], "next": None, "total": 2}),
    )
    page, _ = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", 0, 10, "playlist", affinity_tiers={"known": 3}
    )
    tiers = {s["id"]: s["affinity_tier"] for s in page}
    assert tiers == {"known": 3, "unknown": 0}


def test_get_playlist_songs_page_tier_defaults_to_zero_without_affinity(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service, "spotify_get", lambda *a, **k: DummyResponse(200, {"items": [_item("a")], "next": None, "total": 1})
    )
    page, _ = playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    assert page[0]["affinity_tier"] == 0


# ---------------------------------------------------------------------------
# get_playlist_songs_page — exclusion (song-propagation)
# ---------------------------------------------------------------------------


def test_get_playlist_songs_page_excludes_named_song_ids():
    playlist_songs_service._set_cached_songs(
        "p1", [_song("a", "2020-01-01"), _song("b", "2020-01-02"), _song("c", "2020-01-03")]
    )
    page, total = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", offset=0, limit=10, sort="playlist", exclude_song_ids={"b"}
    )
    assert [s["id"] for s in page] == ["a", "c"]
    assert total == 2


def test_get_playlist_songs_page_exclusion_applied_before_ordering():
    songs = [_song("keep-new", "2020-06-01"), _song("excluded", "2020-01-01"), _song("keep-old", "2020-02-01")]
    playlist_songs_service._set_cached_songs("p1", songs)
    page, total = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", offset=0, limit=10, sort="added_asc", exclude_song_ids={"excluded"}
    )
    assert [s["id"] for s in page] == ["keep-old", "keep-new"]
    assert total == 2


def test_get_playlist_songs_page_excluding_every_song_yields_empty_page():
    playlist_songs_service._set_cached_songs("p1", [_song("a", "2020-01-01"), _song("b", "2020-01-02")])
    page, total = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", offset=0, limit=10, sort="playlist", exclude_song_ids={"a", "b"}
    )
    assert page == []
    assert total == 0


def test_get_playlist_songs_page_exclude_none_is_unchanged():
    playlist_songs_service._set_cached_songs("p1", [_song("a", "2020-01-01")])
    page_a, total_a = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", offset=0, limit=10, sort="playlist", exclude_song_ids=None
    )
    page_b, total_b = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", offset=0, limit=10, sort="playlist"
    )
    assert page_a == page_b
    assert total_a == total_b == 1


def test_get_playlist_songs_page_exclude_empty_set_is_unchanged():
    playlist_songs_service._set_cached_songs("p1", [_song("a", "2020-01-01")])
    page, total = playlist_songs_service.get_playlist_songs_page(
        "token", "p1", offset=0, limit=10, sort="playlist", exclude_song_ids=set()
    )
    assert [s["id"] for s in page] == ["a"]
    assert total == 1


# ---------------------------------------------------------------------------
# get_playlist_song_ids
# ---------------------------------------------------------------------------


def test_get_playlist_song_ids_returns_id_set(monkeypatch):
    monkeypatch.setattr(
        playlist_songs_service,
        "spotify_get",
        lambda *a, **k: DummyResponse(200, {"items": [_item("a"), _item("b")], "next": None, "total": 2}),
    )
    ids = playlist_songs_service.get_playlist_song_ids("token", "p1")
    assert ids == {"a", "b"}


def test_get_playlist_song_ids_hits_cache_on_second_call(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"items": [_item("a")], "next": None, "total": 1})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    playlist_songs_service.get_playlist_song_ids("token", "p1")
    playlist_songs_service.get_playlist_song_ids("token", "p1")
    assert len(calls) == 1


def test_get_playlist_song_ids_refetches_after_cache_invalidated(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"items": [_item("a")], "next": None, "total": 1})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    playlist_songs_service.get_playlist_song_ids("token", "p1")
    playlist_songs_service.invalidate_playlist_cache("p1")
    playlist_songs_service.get_playlist_song_ids("token", "p1")
    assert len(calls) == 2


def test_get_playlist_song_ids_shares_cache_with_get_playlist_songs_page(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(200, {"items": [_item("a")], "next": None, "total": 1})

    monkeypatch.setattr(playlist_songs_service, "spotify_get", fake_get)
    playlist_songs_service.get_playlist_songs_page("token", "p1", 0, 10, "playlist")
    playlist_songs_service.get_playlist_song_ids("token", "p1")
    assert len(calls) == 1
