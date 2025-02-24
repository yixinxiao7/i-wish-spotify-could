import requests


def get_total_liked_songs(access_token: str):
    url = "https://api.spotify.com/v1/me/tracks?limit=1"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.json()}")
    data = response.json()
    return data["total"]


def get_liked_songs(access_token: str, offset:int, limit:int):
    songs = []
    url = f"https://api.spotify.com/v1/me/tracks?limit={limit}&offset={offset}"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Error: {response.status_code} - {response.json()}")

    data = response.json()
    songs.extend(
        [
            {
                "name": item["track"]["name"],
                "artist": ", ".join(artist["name"] for artist in item["track"]["artists"]),
                "album": item["track"]["album"]["name"],
                "url": item["track"]["external_urls"]["spotify"]
            }
            for item in data["items"]
        ]
    )

    return songs
    

__all__ = ['get_total_liked_songs', 'get_liked_songs']