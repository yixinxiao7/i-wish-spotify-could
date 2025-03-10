from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from routers import oauth, songs, playlists


app = FastAPI(title="i-wish-spotify-could api", version="1.0")

# api_router = APIRouter(prefix="/api")
# app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # TODO: Change this to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth.router, prefix="/api/oauth", tags=["OAuth"])
app.include_router(songs.router, prefix="/api/songs", tags=["Songs"])
app.include_router(playlists.router, prefix="/api/playlists", tags=["Playlists"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI application!"}
