import requests


def get_current_user_id(access_token: str):
    url = "https://api.spotify.com/v1/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.json()}")
    data = response.json()
    return data["id"]


__all__ = ["get_current_user_id"]