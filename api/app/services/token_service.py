import json
import time
import os
import requests
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
TOKEN_PATH = "token.json"
BUFFER_SECONDS = 60  # refresh 60s before actual expiry


def get_valid_token() -> str:
    """
    Read the stored token and refresh it if expired or about to expire.
    Returns:
        str: A valid Spotify access token.
    Raises:
        FileNotFoundError: If token.json does not exist (user not authenticated).
        Exception: If the refresh request fails.
    """
    with open(TOKEN_PATH, "r") as f:
        token_data = json.load(f)

    expires_at = token_data.get("expires_at", 0)
    if time.time() < expires_at - BUFFER_SECONDS:
        return token_data["access_token"]

    logger.info("Access token expired or expiring soon — refreshing.")
    refresh_token = token_data["refresh_token"]
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    if response.status_code != 200:
        logger.error("Token refresh failed: %s", response.text)
        raise Exception("Failed to refresh Spotify token")

    new_data = response.json()
    token_data["access_token"] = new_data["access_token"]
    token_data["expires_at"] = int(time.time()) + new_data["expires_in"]
    if "refresh_token" in new_data:
        token_data["refresh_token"] = new_data["refresh_token"]

    with open(TOKEN_PATH, "w") as f:
        json.dump(token_data, f)

    return token_data["access_token"]
