import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CleanPlaylistPage from "./page";
import { ToastProvider } from "@/components/toast-provider";

jest.mock("next/navigation", () => ({
  useParams: () => ({ playlistId: "p1" }),
}));

jest.mock("@/components/ui/song", () => ({
  // Matches the real SongCard's shape — <li><h2>...</h2>...</li> — so
  // page-level tests can assert the list stays a real, non-live list (H6).
  SongCard: ({
    id,
    name,
    onRemove,
  }: {
    id: string;
    name: string;
    onRemove?: (songId: string) => void;
  }) => (
    <li>
      <h2>{name}</h2>
      {onRemove && <button onClick={() => onRemove(id)}>{`remove ${name}`}</button>}
    </li>
  ),
}));

type MockSong = {
  id: string;
  name: string;
  artists: string;
  album: string;
  album_pic_url: string | null;
  added_at: string;
  affinity_tier: number;
};

function song(id: string, name = id): MockSong {
  return { id, name, artists: "Artist", album: "Album", album_pic_url: null, added_at: "2020-01-01", affinity_tier: 0 };
}

function createFetchMock({
  songs = [song("s1", "Song One")],
  total = 1,
  playlistName = "My Playlist",
  affinityAvailable = true,
  affinityReason = null as string | null,
  deleteImpl,
  getStatus = 200,
}: {
  songs?: MockSong[];
  total?: number;
  playlistName?: string;
  affinityAvailable?: boolean;
  affinityReason?: string | null;
  deleteImpl?: (init?: RequestInit) => Promise<Response>;
  getStatus?: number;
} = {}) {
  return jest.fn((input: URL | RequestInfo, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      if (deleteImpl) return deleteImpl(init);
      return Promise.resolve({ ok: true, json: async () => ({ message: "ok" }) }) as Promise<Response>;
    }
    if (getStatus === 404) {
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) as Promise<Response>;
    }
    if (getStatus !== 200) {
      return Promise.resolve({ ok: false, status: getStatus, json: async () => ({}) }) as Promise<Response>;
    }
    const url = String(input);
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get("offset") ?? "0");
    const limit = Number(parsed.searchParams.get("limit") ?? "10");
    const page = songs.slice(offset, offset + limit);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        playlist: { id: "p1", name: playlistName },
        songs: page,
        total,
        affinity: { available: affinityAvailable, reason: affinityReason },
      }),
    }) as Promise<Response>;
  });
}

function renderPage() {
  return render(
    <ToastProvider>
      <CleanPlaylistPage />
    </ToastProvider>
  );
}

describe("Clean playlist page", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (jest.isMockFunction(setTimeout)) jest.useRealTimers();
  });

  it("shows a loading state instead of the empty message while fetching", async () => {
    global.fetch = jest.fn(() => new Promise(() => {})); // never resolves
    renderPage();

    expect(screen.getByText("Loading playlist songs…")).toBeInTheDocument();
    expect(screen.queryByText("This playlist is empty.")).not.toBeInTheDocument();
  });

  it("renders songs with the shared SongCard", async () => {
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());
  });

  it("exposes the song list as a real list with no live region re-announcing every row", async () => {
    global.fetch = createFetchMock({
      songs: [song("s1", "Song One"), song("s2", "Song Two")],
      total: 2,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    const list = screen.getByRole("list", { name: "Playlist songs" });
    expect(list).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    // Removals are already announced via the toast region and loading has
    // its own role="status" — wrapping the whole list in aria-live re-reads
    // every remaining row on every sort, page, or removal (H6).
    expect(list).not.toHaveAttribute("aria-live");
  });

  it("defaults to playlist-order sort", async () => {
    global.fetch = createFetchMock();
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(call[0])).toContain("sort=playlist");
  });

  it("changing the sort issues the right request and resets to page one", async () => {
    global.fetch = createFetchMock({
      songs: Array.from({ length: 15 }, (_, i) => song(`s${i}`, `Song ${i}`)),
      total: 15,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Sort songs by"));
    fireEvent.click(screen.getByText("Oldest added first"));

    await waitFor(() => {
      const last = (global.fetch as jest.Mock).mock.calls.at(-1);
      expect(String(last[0])).toContain("sort=added_asc");
      expect(String(last[0])).toContain("offset=0");
    });
  });

  it("preserves the chosen sort across pagination", async () => {
    global.fetch = createFetchMock({
      songs: Array.from({ length: 15 }, (_, i) => song(`s${i}`, `Song ${i}`)),
      total: 15,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Sort songs by"));
    fireEvent.click(screen.getByText("Newest added first"));
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Go to next page"));

    await waitFor(() => {
      const last = (global.fetch as jest.Mock).mock.calls.at(-1);
      expect(String(last[0])).toContain("sort=added_desc");
      expect(String(last[0])).toContain("offset=10");
    });
  });

  it("disables least-listened sorting and explains why when affinity is unavailable", async () => {
    global.fetch = createFetchMock({ affinityAvailable: false, affinityReason: "missing_scope" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    expect(screen.getByText(/needs one more permission/i)).toBeInTheDocument();
  });

  it("does not show the affinity explanation when it is available", async () => {
    global.fetch = createFetchMock({ affinityAvailable: true });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    expect(screen.queryByText(/needs one more permission/i)).not.toBeInTheDocument();
  });

  it("surfaces an upstream-error affinity reason verbatim, without the log-out instruction", async () => {
    global.fetch = createFetchMock({ affinityAvailable: false, affinityReason: "upstream_error" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    // Logging out and back in only fixes a missing-scope token — telling
    // the user to do it for an upstream failure sends them to burn their
    // session on a step that will not help (H7).
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/log out and back in/i)).not.toBeInTheDocument();
  });

  it("falls back to a generic message for an unrecognized affinity reason", async () => {
    global.fetch = createFetchMock({ affinityAvailable: false, affinityReason: "something_new" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    expect(screen.getByText("Least-listened sorting is unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByText(/log out and back in/i)).not.toBeInTheDocument();
  });

  it("removing a song hides it immediately and issues no request until the window elapses", async () => {
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText("remove Song One"));

    expect(screen.queryByText("Song One")).not.toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore); // no DELETE issued yet
  });

  it("undo within the window issues no request ever and restores the song", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));
    expect(screen.queryByText("Song One")).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(screen.getByText("Song One")).toBeInTheDocument();

    const deleteCallsBefore = (global.fetch as jest.Mock).mock.calls.filter(
      ([, init]) => init?.method === "DELETE"
    ).length;

    act(() => {
      jest.advanceTimersByTime(11000);
    });

    const deleteCallsAfter = (global.fetch as jest.Mock).mock.calls.filter(
      ([, init]) => init?.method === "DELETE"
    ).length;
    expect(deleteCallsAfter).toBe(deleteCallsBefore); // still zero — undo cancelled it for good
    jest.useRealTimers();
  });

  it("hovering the undo toast pauses the removal, and leaving resumes it for the remaining time", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));
    const toastRow = screen.getByText('Removed "Song One"').closest("div[aria-atomic]") as HTMLElement;

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    fireEvent.mouseEnter(toastRow);
    act(() => {
      jest.advanceTimersByTime(20000); // well past the 10s window
    });

    let deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deleteCalls).toHaveLength(0); // paused — never fired

    fireEvent.mouseLeave(toastRow);
    act(() => {
      jest.advanceTimersByTime(7000); // ~6s remained from before the hover
    });

    await waitFor(() => {
      deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "DELETE");
      expect(deleteCalls).toHaveLength(1);
    });
    jest.useRealTimers();
  });

  it("the window elapsing issues exactly one DELETE request", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));

    act(() => {
      jest.advanceTimersByTime(11000);
    });

    await waitFor(() => {
      const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "DELETE");
      expect(deleteCalls).toHaveLength(1);
      expect(JSON.parse(deleteCalls[0][1].body)).toEqual({ songId: "s1" });
    });
    jest.useRealTimers();
  });

  it("two concurrent removals keep independent timers and independent undos", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({ songs: [song("s1", "Song One"), song("s2", "Song Two")], total: 2 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));
    fireEvent.click(screen.getByText("remove Song Two"));

    const undoButtons = await screen.findAllByRole("button", { name: "Undo" });
    fireEvent.click(undoButtons[0]); // undo the first (Song One)
    expect(screen.getByText("Song One")).toBeInTheDocument();
    expect(screen.queryByText("Song Two")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(11000);
    });

    await waitFor(() => {
      const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "DELETE");
      expect(deleteCalls).toHaveLength(1);
      expect(JSON.parse(deleteCalls[0][1].body)).toEqual({ songId: "s2" });
    });
    jest.useRealTimers();
  });

  it("a failed removal restores the row and reports the error", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({
      songs: [song("s1", "Song One")],
      total: 1,
      deleteImpl: () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));
    act(() => {
      jest.advanceTimersByTime(11000);
    });

    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('Failed to remove "Song One". Please try again.')).toBeInTheDocument()
    );
    jest.useRealTimers();
  });

  it("a permission failure reports its own message", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({
      songs: [song("s1", "Song One")],
      total: 1,
      deleteImpl: () => Promise.resolve({ ok: false, status: 403, json: async () => ({}) } as Response),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));
    act(() => {
      jest.advanceTimersByTime(11000);
    });

    await waitFor(() =>
      expect(screen.getByText('The playlist could not be modified — "Song One" was not removed.')).toBeInTheDocument()
    );
    jest.useRealTimers();
  });

  it("unmounting with a pending removal flushes it", async () => {
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song One"));
    unmount();

    const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0][1].keepalive).toBe(true);
  });

  it("removing the last song on a later page moves to a page with content", async () => {
    global.fetch = createFetchMock({
      songs: [...Array.from({ length: 10 }, (_, i) => song(`s${i}`, `Song ${i}`)), song("s10", "Song 10")],
      total: 11,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Go to next page"));
    await waitFor(() => expect(screen.getByText("Song 10")).toBeInTheDocument());

    fireEvent.click(screen.getByText("remove Song 10"));

    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());
  });

  it("renders first/last page links and ellipses like the organize page", async () => {
    // 55 songs at 10/page = 6 pages, so a middle page shows the full
    // structure: prev, 1, ellipsis, n-1, n, n+1, ellipsis, last, next.
    global.fetch = createFetchMock({
      songs: Array.from({ length: 55 }, (_, i) => song(`s${i}`, `Song ${i}`)),
      total: 55,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    // Page 1: Previous is present but disabled (a single Previous/Next pair
    // is always rendered so the responsive collapse has one control to
    // switch, not two); last page + Next are reachable and enabled.
    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute("aria-disabled", "false");

    // Jump to the last page via its link.
    fireEvent.click(screen.getByText("6"));
    await waitFor(() => expect(screen.getByText("Song 50")).toBeInTheDocument());

    // Last page: prev arrow + page-1 link + ellipsis present, Next disabled.
    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("More pages").length).toBeGreaterThan(0);
  });

  it("jumping to the first page from a later page requests offset 0", async () => {
    global.fetch = createFetchMock({
      songs: Array.from({ length: 55 }, (_, i) => song(`s${i}`, `Song ${i}`)),
      total: 55,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByText("6"));
    await waitFor(() => expect(screen.getByText("Song 50")).toBeInTheDocument());

    fireEvent.click(screen.getByText("1"));
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());
    expect(String((global.fetch as jest.Mock).mock.calls.at(-1)![0])).toContain("offset=0");
  });

  it("shows an unavailable message for an unknown or unowned playlist", async () => {
    global.fetch = createFetchMock({ getStatus: 404 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeInTheDocument());
  });

  it("shows a retry option when the playlist fails to load, and retry succeeds", async () => {
    let fail = true;
    global.fetch = jest.fn((input: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({}) }) as Promise<Response>;
      if (fail) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) }) as Promise<Response>;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          playlist: { id: "p1", name: "My Playlist" },
          songs: [song("s1", "Song One")],
          total: 1,
          affinity: { available: true, reason: null },
        }),
      }) as Promise<Response>;
    });

    renderPage();
    // Scoped past name "Notifications": that's the toast host's own
    // always-mounted, empty-until-populated alert region (see M10), not
    // this page's error banner.
    await waitFor(() =>
      expect(screen.getByRole("alert", { name: (name) => name !== "Notifications" })).toBeInTheDocument()
    );

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());
  });
});
