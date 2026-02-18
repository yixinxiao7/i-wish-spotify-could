import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrganizePage from "./page";

jest.mock("@/components/ui/song", () => ({
  SongCard: ({
    name,
    onRefresh,
  }: {
    name: string;
    onRefresh: () => void;
  }) => (
    <div>
      <span>{name}</span>
      <button onClick={onRefresh}>refresh</button>
    </div>
  ),
}));

describe("Organize page", () => {
  const createFetchMock = ({
    total = 30,
    songs = [{ id: "s1", name: "Song One", artists: "Artist A", album: "Album A" }],
    failPlaylists = false,
    failTotal = false,
    failSongs = false,
  }: {
    total?: number;
    songs?: Array<{ id: string; name: string; artists: string; album: string }>;
    failPlaylists?: boolean;
    failTotal?: boolean;
    failSongs?: boolean;
  } = {}) =>
    jest.fn((input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/playlists")) {
        return Promise.resolve(
          failPlaylists
            ? { ok: false, json: async () => ({}) }
            : { ok: true, json: async () => ({ playlists: [{ id: "p1", name: "P1", owner_id: "u1" }] }) }
        ) as Promise<Response>;
      }
      if (url.includes("/api/songs/total")) {
        return Promise.resolve(
          failTotal ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ total }) }
        ) as Promise<Response>;
      }
      if (url.includes("/api/songs")) {
        if (failSongs) {
          return Promise.resolve({ ok: false, json: async () => ({}) }) as Promise<Response>;
        }
        const parsed = new URL(url);
        const offset = Number(parsed.searchParams.get("offset") ?? "0");
        const limit = Number(parsed.searchParams.get("limit") ?? "10");
        return Promise.resolve({
          ok: true,
          json: async () => ({
            songs: songs.map((song, idx) => ({
              ...song,
              id: `${song.id}-${offset}-${limit}-${idx}`,
              name: `${song.name}-${offset}-${limit}-${idx}`,
            })),
          }),
        }) as Promise<Response>;
      }
      return Promise.reject(new Error("Unhandled fetch"));
    });

  beforeEach(() => {
    global.fetch = createFetchMock();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads and renders songs", async () => {
    render(<OrganizePage />);

    await waitFor(() => expect(screen.getByText("Uncategorized Songs")).toBeInTheDocument());
    expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/songs/total"),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(expect.any(URL), expect.any(Object));
  });

  it("supports pagination actions and refresh", async () => {
    render(<OrganizePage />);

    await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Go to next page"));
    await waitFor(() => expect(screen.getByText("Song One-10-10-0")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(screen.getByText("Song One-10-10-0")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Go to previous page"));
    await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());
    fireEvent.click(screen.getByText("3"));
    await waitFor(() => expect(screen.getByText("Song One-20-10-0")).toBeInTheDocument());
    fireEvent.click(screen.getByText("2"));
    await waitFor(() => expect(screen.getByText("Song One-10-10-0")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("25"));

    await waitFor(() => expect(screen.getByText("Song One-10-25-0")).toBeInTheDocument());
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(6);
  });

  it("renders empty list state without pagination when total is zero", async () => {
    global.fetch = createFetchMock({ total: 0, songs: [] });
    render(<OrganizePage />);

    await waitFor(() => expect(screen.getByText("Uncategorized Songs")).toBeInTheDocument());
    expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
  });

  it("handles failed fetches and exits loading state", async () => {
    global.fetch = createFetchMock({ failPlaylists: true, failTotal: true, failSongs: true });
    render(<OrganizePage />);

    await waitFor(() => expect(screen.getByText("Uncategorized Songs")).toBeInTheDocument());
    expect(console.error).toHaveBeenCalled();
  });
});
