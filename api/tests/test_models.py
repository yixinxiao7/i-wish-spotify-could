import pytest
from pydantic import ValidationError

from app.models.schemas import Code, Pagination, SongPostData, PlaybackModel, PinPostData


def test_schema_models_construct():
    code = Code(code="abc", redirect_uri="http://localhost:3000/callback")
    pagination = Pagination(offset=0, limit=10)
    song_post = SongPostData(songId="song-1", playlistIds=["p1", "p2"])
    playback = PlaybackModel(songId="song-1")

    assert code.code == "abc"
    assert code.redirect_uri == "http://localhost:3000/callback"
    assert pagination.limit == 10
    assert song_post.playlistIds == ["p1", "p2"]
    assert playback.songId == "song-1"


def test_code_requires_redirect_uri():
    with pytest.raises(ValidationError):
        Code(code="abc")


def test_code_rejects_empty_redirect_uri():
    with pytest.raises(ValidationError):
        Code(code="abc", redirect_uri="")


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
