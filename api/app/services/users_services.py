from app.services.http_client import spotify_get


def get_current_user_id(access_token: str):
    '''
    Get current user ID
    Args:
        access_token (str): Spotify access token
    Returns:
        str: Spotify user ID
    '''
    url = "https://api.spotify.com/v1/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = spotify_get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.text}")
    data = response.json()
    return data["id"]


__all__ = ["get_current_user_id"]