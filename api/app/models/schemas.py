from pydantic import BaseModel, Field


class Code(BaseModel):
    code: str
    redirect_uri: str = Field(min_length=1)

class Pagination(BaseModel):
    offset: int
    limit: int

class SongPostData(BaseModel):
    songId: str
    playlistIds: list[str]

class PlaybackModel(BaseModel):
    songId: str

class PinPostData(BaseModel):
    playlistId: str = Field(min_length=1)
    pinned: bool
