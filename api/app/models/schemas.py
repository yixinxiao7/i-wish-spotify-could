from pydantic import BaseModel


class Code(BaseModel):
    code: str

class Pagination(BaseModel):
    offset: int
    limit: int
