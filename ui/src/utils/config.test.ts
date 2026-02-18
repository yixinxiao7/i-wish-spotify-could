describe("config", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_WEB_HOST = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SERVER_HOST = "http://localhost:8000";
  });

  it("builds oauth and api endpoints from env vars", async () => {
    const config = await import("./config");

    expect(config.AUTHORIZE_ENDPOINT).toBe("https://accounts.spotify.com/authorize");
    expect(config.REDIRECT_URL).toBe("http://localhost:3000/callback");
    expect(config.POST_TOKEN_ENDPOINT).toBe("http://localhost:8000/api/oauth");
    expect(config.GET_SONGS_ENDPOINT).toBe("http://localhost:8000/api/songs");
    expect(config.PUT_STOP_PLAYBACK_ENDPOINT).toBe("http://localhost:8000/api/playback/stop");
    expect(config.SCOPES).toContain("user-library-read");
  });
});
