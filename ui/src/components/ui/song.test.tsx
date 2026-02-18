import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SongCard } from "./song";

const playlist = {
  id: "p1",
  name: "My Playlist",
  owner_id: "owner",
  playlist_image_url: "https://img.test/1.png",
};

describe("SongCard", () => {
  const originalAlert = window.alert;

  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    window.alert = originalAlert;
  });

  it("renders song metadata", () => {
    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        allPlaylists={[playlist]}
      />
    );

    expect(screen.getByText("Song Name")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
    expect(screen.getByText("Album")).toBeInTheDocument();
  });

  it("toggles playback with start and stop calls", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe("PUT");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect((global.fetch as jest.Mock).mock.calls[1][1].method).toBe("PUT");
  });

  it("alerts when add is clicked with no selected playlists", async () => {
    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        allPlaylists={[playlist]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to playlists" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Playlists" }));

    expect(window.alert).toHaveBeenCalledWith(
      "Please select at least one playlist to add the song to."
    );
  });

  it("adds song to selected playlists and refreshes", async () => {
    const onRefresh = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={onRefresh}
        allPlaylists={[playlist]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to playlists" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    const submit = screen.getByRole("button", { name: "Add to Playlists" });
    submit.focus();
    fireEvent.click(submit);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      (call) => call[1]?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(postCall[1].body).toContain('"songId":"song-1"');
    expect(postCall[1].body).toContain('"playlistIds":["p1"]');
    expect(window.alert).toHaveBeenCalledWith("Songs added to playlists successfully!");
    expect(onRefresh).toHaveBeenCalled();
  });

  it("alerts for playback failure paths", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Failed to start playback.")
    );
  });

  it("alerts when add-song request returns non-ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        allPlaylists={[playlist]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to playlists" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Add to Playlists" }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Failed to add songs to playlists.")
    );
  });

  it("alerts when add-song request throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("boom"));
    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        allPlaylists={[playlist]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to playlists" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Add to Playlists" }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        "An error occurred while adding songs to playlists."
      )
    );
  });

  it("alerts when stop playback fails and when playback throws", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error("boom"));

    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Failed to stop playback.")
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        "An error occurred while toggling playback."
      )
    );
  });

  it("shows no playlists message when none are provided", () => {
    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        allPlaylists={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to playlists" }));
    expect(screen.getByText("No playlists available")).toBeInTheDocument();
  });
});
