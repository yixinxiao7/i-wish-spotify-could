from app.models.schemas import Code, Pagination, SongPostData, PlaybackModel


def test_schema_models_construct():
    code = Code(code="abc")
    pagination = Pagination(offset=0, limit=10)
    song_post = SongPostData(songId="song-1", playlistIds=["p1", "p2"])
    playback = PlaybackModel(songId="song-1")

    assert code.code == "abc"
    assert pagination.limit == 10
    assert song_post.playlistIds == ["p1", "p2"]
    assert playback.songId == "song-1"
