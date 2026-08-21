import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlaylistList } from "./playlist-list";
import { PlaylistsContext } from "@/components/playlists-provider";
import { Playlist } from "@/types/spotify";

const playlists: Playlist[] = [
  { id: "p1", name: "Alpha", owner_id: "u1", pinned: false },
  { id: "p2", name: "Beta", owner_id: "u1", pinned: true },
];

describe("PlaylistList", () => {
  it("renders playlists pinned-first via the playlists prop override", () => {
    render(<PlaylistList playlists={playlists} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Beta");
    expect(items[1]).toHaveTextContent("Alpha");
  });

  it("shows the empty state when there are no playlists", () => {
    render(<PlaylistList playlists={[]} />);
    expect(screen.getByText("No playlists available")).toBeInTheDocument();
  });

  it("supports a custom empty message", () => {
    render(<PlaylistList playlists={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("omits the selection checkbox when onToggleSelect is absent", () => {
    render(<PlaylistList playlists={playlists} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders selection checkboxes reflecting selectedIds", () => {
    render(
      <PlaylistList
        playlists={playlists}
        selectedIds={new Set(["p1"])}
        onToggleSelect={jest.fn()}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
  });

  it("calls onToggleSelect with the playlist and checked state", () => {
    const onToggleSelect = jest.fn();
    render(
      <PlaylistList
        playlists={[playlists[0]]}
        selectedIds={new Set()}
        onToggleSelect={onToggleSelect}
      />
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleSelect).toHaveBeenCalledWith(playlists[0], true);
  });

  it("shows aria-pressed reflecting pin state", () => {
    render(<PlaylistList playlists={playlists} />);
    expect(screen.getByRole("button", { name: "Pin Alpha" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Unpin Beta" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls the onTogglePin override with the inverted pin state", () => {
    const onTogglePin = jest.fn();
    render(<PlaylistList playlists={playlists} onTogglePin={onTogglePin} />);
    fireEvent.click(screen.getByRole("button", { name: "Pin Alpha" }));
    expect(onTogglePin).toHaveBeenCalledWith("p1", true);
  });

  it("supports keyboard activation of the pin toggle", () => {
    const onTogglePin = jest.fn();
    render(<PlaylistList playlists={playlists} onTogglePin={onTogglePin} />);
    const pinButton = screen.getByRole("button", { name: "Pin Alpha" });
    pinButton.focus();
    fireEvent.click(pinButton);
    expect(onTogglePin).toHaveBeenCalledWith("p1", true);
  });

  it("toggling pin does not affect selection", () => {
    const onToggleSelect = jest.fn();
    const onTogglePin = jest.fn();
    render(
      <PlaylistList
        playlists={playlists}
        selectedIds={new Set()}
        onToggleSelect={onToggleSelect}
        onTogglePin={onTogglePin}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin Alpha" }));
    expect(onTogglePin).toHaveBeenCalled();
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("falls back to the PlaylistsProvider context when no playlists prop is given", () => {
    const togglePin = jest.fn();
    render(
      <PlaylistsContext.Provider value={{ playlists, loading: false, error: null, togglePin }}>
        <PlaylistList />
      </PlaylistsContext.Provider>
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("uses context togglePin when no onTogglePin override is provided", async () => {
    const togglePin = jest.fn().mockResolvedValue(undefined);
    render(
      <PlaylistsContext.Provider value={{ playlists, loading: false, error: null, togglePin }}>
        <PlaylistList />
      </PlaylistsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin Alpha" }));
    await waitFor(() => expect(togglePin).toHaveBeenCalledWith("p1", true));
  });
});
