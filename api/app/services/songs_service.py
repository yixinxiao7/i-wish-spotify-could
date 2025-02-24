import requests

def get_all_liked_songs(access_token):
    all_songs = []
    offset = 0
    total = 1  # Start with a non-zero value to enter the loop
    while offset < total:
        url = f"https://api.spotify.com/v1/me/tracks?limit=50&offset={offset}"
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.json()}")

        data = response.json()
        total = data["total"]
        all_songs.extend(
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

        offset += 50

    return all_songs
    