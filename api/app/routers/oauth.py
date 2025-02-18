from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import requests
import os
from dotenv import load_dotenv
from models.schemas import Code


# Load environment variables from .env file
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI")
router = APIRouter()


@router.post("/")
def set_token(code: Code):
    """
    Exchange authorization code for a Spotify access token.
    """
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    token_url = "https://accounts.spotify.com/api/token"

    payload = {
        "grant_type": "authorization_code",
        "code": code.code,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "client_id": SPOTIFY_CLIENT_ID,
        "client_secret": SPOTIFY_CLIENT_SECRET,
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    response = requests.post(token_url, data=payload, headers=headers)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    # TODO: change to token manager like redis
    with open("token.json", "w") as f:
        f.write(response.text)

    return JSONResponse(
        content={"message": "successfully exchanged code for token.",
                 "expires_in": response.json()["expires_in"]},
        status_code=200
        )
