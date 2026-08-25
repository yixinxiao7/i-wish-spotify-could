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

  it("narrows the visible rows to those matching the filter text", () => {
    render(<PlaylistList playlists={playlists} onToggleSelect={jest.fn()} selectedIds={new Set()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Filter playlists"), { target: { value: "alph" } });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Alpha");
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("keeps an already-selected playlist selected while it is filtered out of view", () => {
    const onToggleSelect = jest.fn();
    render(
      <PlaylistList
        playlists={playlists}
        selectedIds={new Set(["p2"])} // Beta selected
        onToggleSelect={onToggleSelect}
      />
    );
    expect(screen.getByRole("checkbox", { name: "Beta" })).toBeChecked();

    fireEvent.change(screen.getByLabelText("Filter playlists"), { target: { value: "alph" } });
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter playlists"), { target: { value: "" } });
    expect(screen.getByRole("checkbox", { name: "Beta" })).toBeChecked();
  });

  it("shows a message naming the filter text when nothing matches, not the generic empty state", () => {
    render(<PlaylistList playlists={playlists} onToggleSelect={jest.fn()} selectedIds={new Set()} />);
    fireEvent.change(screen.getByLabelText("Filter playlists"), { target: { value: "zzz-no-match" } });

    expect(screen.getByText('No playlists match "zzz-no-match".')).toBeInTheDocument();
    expect(screen.queryByText("No playlists available")).not.toBeInTheDocument();
  });

  it("omits the filter field when there is only one playlist", () => {
    render(<PlaylistList playlists={[playlists[0]]} onToggleSelect={jest.fn()} selectedIds={new Set()} />);
    expect(screen.queryByLabelText("Filter playlists")).not.toBeInTheDocument();
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
      <PlaylistsContext.Provider value={{ playlists, loading: false, error: null, togglePin, refetch: jest.fn() }}>
        <PlaylistList />
      </PlaylistsContext.Provider>
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("uses context togglePin when no onTogglePin override is provided", async () => {
    const togglePin = jest.fn().mockResolvedValue(undefined);
    render(
      <PlaylistsContext.Provider value={{ playlists, loading: false, error: null, togglePin, refetch: jest.fn() }}>
        <PlaylistList />
      </PlaylistsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin Alpha" }));
    await waitFor(() => expect(togglePin).toHaveBeenCalledWith("p1", true));
  });

  it("renders the row label as a plain label when onSelectPlaylist is absent", () => {
    render(<PlaylistList playlists={playlists} />);
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
    expect(screen.getByText("Alpha").tagName).toBe("LABEL");
  });

  it("renders the row label as a button and calls onSelectPlaylist when activated", () => {
    const onSelectPlaylist = jest.fn();
    render(<PlaylistList playlists={playlists} onSelectPlaylist={onSelectPlaylist} />);
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onSelectPlaylist).toHaveBeenCalledWith(playlists[0]);
  });

  it("makes the whole row the navigation target, not just the label text", () => {
    render(<PlaylistList playlists={playlists} onSelectPlaylist={jest.fn()} />);
    const rowButton = screen.getByRole("button", { name: "Alpha" });
    // The row's own art/name button carries at least the 44px minimum
    // target height (M1) and spans the row rather than hugging the text.
    expect(rowButton.className).toContain("min-h-[44px]");
    expect(rowButton.className).toContain("flex-1");
    // The art placeholder (icons are stubbed in this test environment; see
    // jest.setup.ts) is inside the button, not a separate sibling — so
    // clicking the artwork activates navigation too.
    expect(rowButton.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("activating the pin toggle does not call onSelectPlaylist", () => {
    const onSelectPlaylist = jest.fn();
    const onTogglePin = jest.fn();
    render(
      <PlaylistList playlists={playlists} onSelectPlaylist={onSelectPlaylist} onTogglePin={onTogglePin} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin Alpha" }));
    expect(onTogglePin).toHaveBeenCalled();
    expect(onSelectPlaylist).not.toHaveBeenCalled();
  });
});
