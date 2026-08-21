import pytest
from pydantic import ValidationError

from app.models.schemas import Code, Pagination, SongPostData, PlaybackModel, PinPostData


def test_schema_models_construct():
    code = Code(code="abc")
    pagination = Pagination(offset=0, limit=10)
    song_post = SongPostData(songId="song-1", playlistIds=["p1", "p2"])
    playback = PlaybackModel(songId="song-1")

    assert code.code == "abc"
    assert pagination.limit == 10
    assert song_post.playlistIds == ["p1", "p2"]
    assert playback.songId == "song-1"


def test_pin_post_data_constructs():
    pin = PinPostData(playlistId="p1", pinned=True)
    assert pin.playlistId == "p1"
    assert pin.pinned is True


def test_pin_post_data_rejects_empty_playlist_id():
    with pytest.raises(ValidationError):
        PinPostData(playlistId="", pinned=True)


def test_pin_post_data_rejects_missing_playlist_id():
    with pytest.raises(ValidationError):
        PinPostData(pinned=True)
