import json

import pytest

from app.services import songs_service


class DummyResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def test_get_total_liked_songs_success(monkeypatch):
    monkeypatch.setattr(
        songs_service.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(200, {"total": 77}),
    )
    assert songs_service.get_total_liked_songs("token") == 77


def test_get_total_liked_songs_error(monkeypatch):
    monkeypatch.setattr(
        songs_service.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(403, {"error": "denied"}),
    )
    with pytest.raises(Exception, match="Error: 403"):
        songs_service.get_total_liked_songs("token")


def test_get_liked_songs_paginates_and_transforms(monkeypatch):
    calls = []

    def fake_get(url, headers=None):
        calls.append(url)
        if "offset=0" in url:
            return DummyResponse(
                200,
                {
                    "total": 51,
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
        return DummyResponse(
            200,
            {
                "total": 51,
                "items": [
                    {
                        "track": {
                            "id": "s2",
                            "name": "Song 2",
                            "artists": [{"name": "A3"}],
                            "album": {"name": "Album 2", "images": []},
                        }
                    }
                ],
            },
        )

    monkeypatch.setattr(songs_service.requests, "get", fake_get)
    songs = songs_service.get_liked_songs("token")
    assert len(songs) == 2
    assert songs[0]["artists"] == "A1, A2"
    assert songs[1]["album_pic_url"] is None
    assert len(calls) == 2


def test_get_liked_songs_error(monkeypatch):
    monkeypatch.setattr(
        songs_service.requests,
        "get",
        lambda *args, **kwargs: DummyResponse(500, {"error": "bad"}),
    )
    with pytest.raises(Exception, match="Error: 500"):
        songs_service.get_liked_songs("token")


def test_get_uncategorized_songs_reads_cache_file():
    with open("all_uncategorized_songs.json", "w", encoding="utf-8") as f:
        f.write(json.dumps([{"id": "s1"}, {"id": "s2"}, {"id": "s3"}]))

    songs = songs_service.get_uncategorized_songs("token", offset=1, limit=1)
    assert songs == [{"id": "s2"}]


def test_get_uncategorized_songs_builds_and_writes_cache(monkeypatch):
    liked_songs = [
        {"id": "s1", "name": "Song 1", "artists": "A", "album": "X", "album_pic_url": None},
        {"id": "s2", "name": "Song 2", "artists": "B", "album": "Y", "album_pic_url": None},
    ]
    playlists = [{"id": "p1"}, {"id": "p2"}]

    monkeypatch.setattr(songs_service, "get_liked_songs", lambda token: liked_songs)
    monkeypatch.setattr(songs_service, "get_created_playlists", lambda token: playlists)
    monkeypatch.setattr(
        songs_service,
        "get_playlist_songs",
        lambda token, playlist_id: [{"track": {"id": "s2"}}] if playlist_id == "p1" else [],
    )

    songs = songs_service.get_uncategorized_songs("token", offset=0, limit=10)
    assert songs == [liked_songs[0]]
    with open("all_uncategorized_songs.json", "r", encoding="utf-8") as f:
        saved = json.loads(f.read())
    assert saved == [liked_songs[0]]


def test_get_total_uncategorized_songs_reads_length():
    with open("all_uncategorized_songs.json", "w", encoding="utf-8") as f:
        f.write(json.dumps([{"id": "s1"}, {"id": "s2"}]))
    assert songs_service.get_total_uncategorized_songs() == 2


def test_get_total_uncategorized_songs_times_out(monkeypatch):
    monkeypatch.setattr(songs_service.os.path, "exists", lambda *args, **kwargs: False)
    monkeypatch.setattr(songs_service.time, "sleep", lambda *args, **kwargs: None)
    with pytest.raises(Exception, match="Timed out waiting for uncategorized songs cache to be created"):
        songs_service.get_total_uncategorized_songs()
