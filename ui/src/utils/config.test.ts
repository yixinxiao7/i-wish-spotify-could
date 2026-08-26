describe("config", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_SERVER_HOST = "http://localhost:8000";
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("builds oauth and api endpoints from env vars", async () => {
    const config = await import("./config");

    expect(config.AUTHORIZE_ENDPOINT).toBe("https://accounts.spotify.com/authorize");
    expect(config.POST_TOKEN_ENDPOINT).toBe("http://localhost:8000/api/oauth/");
    expect(config.GET_SONGS_ENDPOINT).toBe("http://localhost:8000/api/songs/");
    expect(config.PUT_STOP_PLAYBACK_ENDPOINT).toBe("http://localhost:8000/api/playback/stop");
    expect(config.SCOPES).toContain("user-library-read");
  });

  it("builds the plain playlist-songs URL without exclude_playlist_id when omitted", async () => {
    const config = await import("./config");
    expect(config.getPlaylistSongsEndpoint("p1")).toBe(
      "http://localhost:8000/api/playlists/p1/songs"
    );
  });

  it("appends exclude_playlist_id when given a playlist to exclude", async () => {
    const config = await import("./config");
    expect(config.getPlaylistSongsEndpoint("p1", "p2")).toBe(
      "http://localhost:8000/api/playlists/p1/songs?exclude_playlist_id=p2"
    );
  });

  it("derives the redirect url from the live browser origin", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://127.0.0.1:3000" },
    });
    const config = await import("./config");

    expect(config.getRedirectUrl()).toBe("http://127.0.0.1:3000/callback");
  });
});
