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
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
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

  it("shows toast when add is clicked with no selected playlists", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "add to playlists" }));
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(
      await screen.findByText("Please select at least one playlist to add the song to.")
    ).toBeInTheDocument();
  });

  it("adds song to selected playlists and refreshes", async () => {
    const onRefresh = jest.fn();
    const onSuccess = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={onRefresh}
        onSuccess={onSuccess}
        allPlaylists={[playlist]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "add to playlists" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    const submit = screen.getByRole("button", { name: "add" });
    submit.focus();
    fireEvent.click(submit);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      (call) => call[1]?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(postCall[1].body).toContain('"songId":"song-1"');
    expect(postCall[1].body).toContain('"playlistIds":["p1"]');
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("Songs added to playlists successfully!")
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it("shows toast for playback failure paths", async () => {
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
    expect(await screen.findByText("Failed to start playback.")).toBeInTheDocument();
  });

  it("shows toast when add-song request returns non-ok", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "add to playlists" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(await screen.findByText("Failed to add songs to playlists.")).toBeInTheDocument();
  });

  it("shows toast when add-song request throws", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "add to playlists" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(
      await screen.findByText("An error occurred while adding songs to playlists.")
    ).toBeInTheDocument();
  });

  it("shows toast when stop playback fails and when playback throws", async () => {
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
    expect(await screen.findByText("Failed to stop playback.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(
      await screen.findByText("An error occurred while toggling playback.")
    ).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "add to playlists" }));
    expect(screen.getByText("No playlists available")).toBeInTheDocument();
  });

  it("dismisses toast when the X button is clicked", async () => {
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
    const toast = await screen.findByText("Failed to start playback.");
    expect(toast).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() =>
      expect(screen.queryByText("Failed to start playback.")).not.toBeInTheDocument()
    );
  });
});
