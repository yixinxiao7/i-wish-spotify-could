import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from app.routers import oauth, songs, playlists, playback


app = FastAPI(title="i-wish-spotify-could api", version="1.0", redirect_slashes=False)

# api_router = APIRouter(prefix="/api")
# app.include_router(api_router)

origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(oauth.router, prefix="/api/oauth", tags=["OAuth"])
app.include_router(songs.router, prefix="/api/songs", tags=["Songs"])
app.include_router(playlists.router, prefix="/api/playlists", tags=["Playlists"])
app.include_router(playback.router, prefix="/api/playback", tags=["Playback"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI application!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
