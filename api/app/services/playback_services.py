import requests


def toggle_playback(access_token: str, action: str, song_id: str) -> None:
    '''
    Toggle playback state on Spotify
    Args:
        access_token (str): Spotify access token
        action (str): "play" to start playback, "pause" to stop playback
    Returns:
        None
    '''
    url = f"https://api.spotify.com/v1/me/player/{action}"
    headers = {"Authorization": f"Bearer {access_token}"}
    data = {"uris": [f"spotify:track:{song_id}"]}
    response = requests.put(url, headers=headers, json=data)
    if response.status_code != 204:
        raise Exception(f"Error toggling playback: {response.status_code} - {response.json()}")

__all__ = ["toggle_playback"]