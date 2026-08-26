import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SongCard } from "./song";
import { ToastProvider } from "@/components/toast-provider";

const playlist = {
  id: "p1",
  name: "My Playlist",
  owner_id: "owner",
  playlist_image_url: "https://img.test/1.png",
};

function renderSong(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("SongCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("renders song metadata", () => {
    renderSong(
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

  it("hides the album line when the album repeats the track name", () => {
    renderSong(
      <SongCard id="song-1" name="Same" artists="Artist" album="Same" onRefresh={jest.fn()} />
    );
    expect(screen.queryAllByText("Same")).toHaveLength(1); // only the title
  });

  it("hides the album line when the album repeats the artist (M8)", () => {
    renderSong(
      <SongCard id="song-1" name="Track" artists="Arash" album="Arash" onRefresh={jest.fn()} />
    );
    expect(screen.queryAllByText("Arash")).toHaveLength(1); // only the artist line
  });

  it("shows the album line when it genuinely differs from both the track and the artist", () => {
    renderSong(
      <SongCard id="song-1" name="Track" artists="Artist" album="A Different Album" onRefresh={jest.fn()} />
    );
    expect(screen.getByText("A Different Album")).toBeInTheDocument();
  });

  it("exposes itself as a list item with its title as a heading", () => {
    renderSong(
      <ul>
        <SongCard
          id="song-1"
          name="Song Name"
          artists="Artist"
          album="Album"
          onRefresh={jest.fn()}
          allPlaylists={[playlist]}
        />
      </ul>
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "Song Name" });
    expect(heading.tagName).toBe("H2");
  });

  it("toggles playback with start and stop calls", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    renderSong(
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
    renderSong(
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

    renderSong(
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

    renderSong(
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
    renderSong(
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
    renderSong(
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

    renderSong(
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
    renderSong(
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

  it("shows a pin toggle for each playlist in the add-to-playlist dialog", () => {
    renderSong(
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
    expect(screen.getByRole("button", { name: "Pin My Playlist" })).toBeInTheDocument();
  });

  it("describes the dialog itself, not the playlist list, as its accessible description", () => {
    renderSong(
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
    const dialog = screen.getByRole("dialog");
    const describedById = dialog.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const description = document.getElementById(describedById!);
    expect(description).toHaveTextContent("Select one or more playlists to add this song to.");
    // The playlist list itself must not be what's wired up as the description.
    expect(description).not.toHaveTextContent("My Playlist");
  });

  it("dismisses toast when the X button is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    renderSong(
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

  it("renders no trash control when onRemove is absent", () => {
    renderSong(
      <SongCard id="song-1" name="Song Name" artists="Artist" album="Album" onRefresh={jest.fn()} />
    );
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("renders an accessibly-named, keyboard-operable trash control and calls onRemove with the song id", () => {
    const onRemove = jest.fn();
    renderSong(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        onRemove={onRemove}
      />
    );

    const trashButton = screen.getByRole("button", { name: "Remove Song Name" });
    expect(trashButton.tagName).toBe("BUTTON"); // native element: keyboard operability is inherent
    fireEvent.click(trashButton);
    expect(onRemove).toHaveBeenCalledWith("song-1");
  });

  it("renders no plus control when onAdd is absent", () => {
    renderSong(
      <SongCard id="song-1" name="Song Name" artists="Artist" album="Album" onRefresh={jest.fn()} />
    );
    expect(screen.queryByRole("button", { name: "Add Song Name" })).not.toBeInTheDocument();
  });

  it("renders an accessibly-named, keyboard-operable plus control and calls onAdd with the song id", () => {
    const onAdd = jest.fn();
    renderSong(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        onAdd={onAdd}
      />
    );

    const addButton = screen.getByRole("button", { name: "Add Song Name" });
    expect(addButton.tagName).toBe("BUTTON"); // native element: keyboard operability is inherent
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalledWith("song-1");
  });

  it("hides the add-to-playlists trigger and dialog when showAddToPlaylists is false", () => {
    renderSong(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        showAddToPlaylists={false}
      />
    );
    expect(screen.queryByRole("button", { name: "add to playlists" })).not.toBeInTheDocument();
  });

  it("defaults showAddToPlaylists to true, leaving existing rendering unchanged", () => {
    renderSong(
      <SongCard id="song-1" name="Song Name" artists="Artist" album="Album" onRefresh={jest.fn()} />
    );
    expect(screen.getByRole("button", { name: "add to playlists" })).toBeInTheDocument();
  });

  it("renders onAdd and onRemove together without layout breakage", () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    renderSong(
      <SongCard
        id="song-1"
        name="Song Name"
        artists="Artist"
        album="Album"
        onRefresh={jest.fn()}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    );
    expect(screen.getByRole("button", { name: "Add Song Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Song Name" })).toBeInTheDocument();
  });
});
