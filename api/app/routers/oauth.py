from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import requests
import os
import time
import json
import logging
from dotenv import load_dotenv
from app.models.schemas import Code

logger = logging.getLogger(__name__)


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
    Args:
        code (Code): Authorization code
    Returns:
        JSONResponse: Success message
        {
            "message": str,
            "expires_in": int
        }
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
        logger.error("Spotify token exchange failed (%s): %s", response.status_code, response.text)
        raise HTTPException(status_code=502, detail="Failed to exchange authorization code")

    token_data = response.json()
    token_data["expires_at"] = int(time.time()) + token_data["expires_in"]

    # TODO: change to token manager like redis
    with open("token.json", "w") as f:
        json.dump(token_data, f)

    return JSONResponse(
        content={"message": "successfully exchanged code for token.",
                 "expires_in": token_data["expires_in"]},
        status_code=200
        )


@router.delete("/logout")
def logout():
    """
    Clear the stored token and cached user data to force re-authentication.
    """
    for path in ("token.json", "user_id.json", "all_uncategorized_songs.json"):
        if os.path.exists(path):
            os.remove(path)
    return {"message": "logged out successfully"}
