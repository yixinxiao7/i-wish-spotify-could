def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the FastAPI application!"}


def test_openapi_contains_expected_paths(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/oauth/" in paths
    assert "/api/songs/" in paths
    assert "/api/songs/total" in paths
    assert "/api/playlists/" in paths
    assert "/api/playlists/add-song" in paths
    assert "/api/playback/start" in paths
    assert "/api/playback/stop" in paths
