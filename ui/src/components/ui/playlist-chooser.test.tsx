import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PlaylistChooser } from "./playlist-chooser";
import { PlaylistsProvider } from "@/components/playlists-provider";
import { Playlist } from "@/types/spotify";

function renderChooser(onSelectPlaylist: (playlist: Playlist) => void = jest.fn()) {
  return render(
    <PlaylistsProvider>
      <PlaylistChooser
        title="pick a playlist"
        description="choose one to continue."
        emptyMessage="You don't own any playlists yet."
        onSelectPlaylist={onSelectPlaylist}
      />
    </PlaylistsProvider>
  );
}

describe("PlaylistChooser", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows a loading state while playlists are fetched", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    renderChooser();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders playlist rows once loaded", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }],
      }),
    });

    renderChooser();
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    expect(screen.getByText("pick a playlist")).toBeInTheDocument();
    expect(screen.getByText("choose one to continue.")).toBeInTheDocument();
  });

  it("invokes onSelectPlaylist with the chosen playlist", async () => {
    const onSelectPlaylist = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }],
      }),
    });

    renderChooser(onSelectPlaylist);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onSelectPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", name: "Alpha" })
    );
  });

  it("shows an empty state when the user owns no playlists", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ playlists: [] }) });

    renderChooser();
    await waitFor(() =>
      expect(screen.getByText("You don't own any playlists yet.")).toBeInTheDocument()
    );
  });

  it("shows an error with a working retry action", async () => {
    let shouldFail = true;
    global.fetch = jest.fn().mockImplementation(() =>
      shouldFail
        ? Promise.resolve({ ok: false })
        : Promise.resolve({
            ok: true,
            json: async () => ({ playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }] }),
          })
    );

    renderChooser();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
  });
});
