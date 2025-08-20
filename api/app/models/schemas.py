from pydantic import BaseModel


class Code(BaseModel):
    code: str

class Pagination(BaseModel):
    offset: int
    limit: int

class SongPostData(BaseModel):
    songId: str
    playlistIds: list[str]

class PlaybackModel(BaseModel):
    songId: str
