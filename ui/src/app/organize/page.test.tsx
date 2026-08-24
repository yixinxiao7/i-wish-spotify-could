import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OrganizePage from "./page";
import { ToastProvider } from "@/components/toast-provider";

jest.mock("@/components/ui/song", () => ({
  // The real SongCard renders <li><h2>...</h2>...</li> (see song.tsx and
  // song.test.tsx for the semantics themselves); the mock matches that
  // shape so page-level tests can assert the list stays a real list.
  SongCard: ({
    name,
    onRefresh,
  }: {
    name: string;
    onRefresh: () => void;
  }) => (
    <li>
      <h2>{name}</h2>
      <button onClick={onRefresh}>refresh</button>
    </li>
  ),
}));

describe("Organize page", () => {
  const createFetchMock = ({
    total = 30,
    songs = [{ id: "s1", name: "Song One", artists: "Artist A", album: "Album A" }],
    failPlaylists = false,
    failTotal = false,
    failSongs = false,
    refreshImpl,
  }: {
    total?: number;
    songs?: Array<{ id: string; name: string; artists: string; album: string }>;
    failPlaylists?: boolean;
    failTotal?: boolean;
    failSongs?: boolean;
    refreshImpl?: (init?: RequestInit) => Promise<Response>;
  } = {}) =>
    jest.fn((input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/songs/refresh")) {
        if (refreshImpl) return refreshImpl(init);
        return Promise.resolve({ ok: true, json: async () => ({ total }) }) as Promise<Response>;
      }
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
    render(<ToastProvider><OrganizePage /></ToastProvider>);

    expect(screen.getByText("uncategorized songs")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/songs/total"),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(expect.any(URL), expect.any(Object));
  });

  it("exposes the song list as a real, countable list", async () => {
    render(<ToastProvider><OrganizePage /></ToastProvider>);
    await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());

    const list = screen.getByRole("list", { name: "Uncategorized songs" });
    expect(list).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("supports pagination actions and refresh", async () => {
    render(<ToastProvider><OrganizePage /></ToastProvider>);

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

    // A page-size change returns to offset 0 / page 1 — the only position
    // consistent with the new size — rather than keeping the prior offset.
    await waitFor(() => expect(screen.getByText("Song One-0-25-0")).toBeInTheDocument());
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(6);
  });

  it("renders empty list state without pagination when total is zero", async () => {
    global.fetch = createFetchMock({ total: 0, songs: [] });
    render(<ToastProvider><OrganizePage /></ToastProvider>);

    await waitFor(() =>
      expect(screen.getByText("No uncategorized songs found. All your liked songs are already in playlists!")).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
  });

  it("reports a failed fetch as an error, not as an empty library", async () => {
    global.fetch = createFetchMock({ failPlaylists: true, failTotal: true, failSongs: true });
    render(<ToastProvider><OrganizePage /></ToastProvider>);

    // The empty state is a claim about the user's library ("all your liked
    // songs are already in playlists"). Showing it when the request failed
    // tells the user something untrue about their own data.
    // Scoped past name "Notifications": that's the toast host's own
    // always-mounted, empty-until-populated alert region (see M10), not
    // this page's error banner.
    await waitFor(() =>
      expect(screen.getByRole("alert", { name: (name) => name !== "Notifications" })).toBeInTheDocument()
    );
    expect(
      screen.queryByText("No uncategorized songs found. All your liked songs are already in playlists!")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });

  it("surfaces the server's own error message, such as a rate-limit explanation", async () => {
    const rateLimitMessage =
      "Spotify is rate limiting this app right now. This usually clears on its own within an hour — please try again later.";
    global.fetch = jest.fn((input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/playlists")) {
        return Promise.resolve({ ok: true, json: async () => ({ playlists: [] }) }) as Promise<Response>;
      }
      return Promise.resolve({
        ok: false,
        status: 429,
        json: async () => ({ detail: rateLimitMessage }),
      }) as Promise<Response>;
    }) as jest.Mock;

    render(<ToastProvider><OrganizePage /></ToastProvider>);

    await waitFor(() => expect(screen.getAllByText(rateLimitMessage).length).toBeGreaterThan(0));
  });

  it("still shows the empty-library state when the load genuinely returns no songs", async () => {
    global.fetch = createFetchMock({ total: 0, songs: [] });
    render(<ToastProvider><OrganizePage /></ToastProvider>);

    await waitFor(() =>
      expect(
        screen.getByText("No uncategorized songs found. All your liked songs are already in playlists!")
      ).toBeInTheDocument()
    );
    // The toast host's own empty alert region is always mounted (M10); what
    // matters here is that this page's own error banner did not appear.
    expect(screen.queryByRole("alert", { name: (name) => name !== "Notifications" })).not.toBeInTheDocument();
  });

  it("shows a slow-loading notice if the request is still pending after a few seconds", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = jest.fn(() => new Promise(() => {})); // never resolves

    render(<ToastProvider><OrganizePage /></ToastProvider>);

    expect(screen.queryByText(/Scanning your liked songs/)).not.toBeInTheDocument();
    jest.advanceTimersByTime(4000);
    await waitFor(() =>
      expect(screen.getByText(/Scanning your liked songs/)).toBeInTheDocument()
    );

    jest.useRealTimers();
  });

  it("shows a retry option after the load times out, and retrying re-issues the request", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const slowFetch = createFetchMock();
    let callCount = 0;
    global.fetch = jest.fn((...args: Parameters<typeof fetch>) => {
      callCount += 1;
      // First round of requests (the initial load) never resolves, so the
      // timeout fires; the retry after that uses the normal fast mock.
      if (callCount <= 2) return new Promise(() => {});
      return (slowFetch as unknown as typeof fetch)(...args);
    }) as jest.Mock;

    render(<ToastProvider><OrganizePage /></ToastProvider>);

    jest.advanceTimersByTime(25000);
    await waitFor(() =>
      expect(screen.getByText(/taking longer than expected/)).toBeInTheDocument()
    );

    jest.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());
  });

  describe("refresh from Spotify control", () => {
    it("is keyboard operable and accessibly named", async () => {
      render(<ToastProvider><OrganizePage /></ToastProvider>);
      await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());

      const button = screen.getByRole("button", { name: /Refresh from Spotify/i });
      expect(button.tagName).toBe("BUTTON"); // native element: keyboard operability is inherent
      expect(button).not.toBeDisabled();
    });

    it("triggers a POST to the refresh endpoint and refreshes songs and total", async () => {
      global.fetch = createFetchMock({
        total: 5,
        songs: [{ id: "orig", name: "Original Song", artists: "A", album: "Al" }],
      });
      render(<ToastProvider><OrganizePage /></ToastProvider>);
      await waitFor(() => expect(screen.getByText("Original Song-0-10-0")).toBeInTheDocument());

      // After refresh, the backend reflects a different library state.
      global.fetch = createFetchMock({
        total: 1,
        songs: [{ id: "fresh", name: "Fresh Song", artists: "A", album: "Al" }],
      });

      fireEvent.click(screen.getByRole("button", { name: /Refresh from Spotify/i }));

      await waitFor(() => {
        const refreshCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
          String(url).includes("/api/songs/refresh")
        );
        expect(refreshCall).toBeTruthy();
        expect(refreshCall![1]).toMatchObject({ method: "POST" });
      });

      await waitFor(() => expect(screen.getByText("Fresh Song-0-10-0")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText("Uncategorized songs refreshed.")).toBeInTheDocument());
    });

    it("shows in-progress state and blocks a second click while refreshing", async () => {
      let resolveRefresh: (() => void) | undefined;
      const pendingRefresh = new Promise<Response>((resolve) => {
        resolveRefresh = () => resolve({ ok: true, json: async () => ({ total: 30 }) } as Response);
      });
      global.fetch = createFetchMock({ refreshImpl: () => pendingRefresh });

      render(<ToastProvider><OrganizePage /></ToastProvider>);
      await waitFor(() => expect(screen.getByText("Song One-0-10-0")).toBeInTheDocument());

      const button = screen.getByRole("button", { name: /Refresh from Spotify/i });
      fireEvent.click(button);

      await waitFor(() => expect(screen.getByRole("button", { name: /Refreshing/i })).toBeDisabled());

      const refreshCallsBeforeSecondClick = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        String(url).includes("/api/songs/refresh")
      ).length;
      fireEvent.click(screen.getByRole("button", { name: /Refreshing/i })); // no-op: disabled and guarded
      const refreshCallsAfterSecondClick = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        String(url).includes("/api/songs/refresh")
      ).length;
      expect(refreshCallsAfterSecondClick).toBe(refreshCallsBeforeSecondClick);

      resolveRefresh!();
      await waitFor(() => expect(screen.getByRole("button", { name: /Refresh from Spotify/i })).not.toBeDisabled());
    });

    it("toasts on failure and leaves the displayed songs unchanged", async () => {
      global.fetch = createFetchMock({
        total: 5,
        songs: [{ id: "orig", name: "Original Song", artists: "A", album: "Al" }],
      });
      render(<ToastProvider><OrganizePage /></ToastProvider>);
      await waitFor(() => expect(screen.getByText("Original Song-0-10-0")).toBeInTheDocument());

      global.fetch = createFetchMock({
        refreshImpl: () => Promise.resolve({ ok: false, json: async () => ({}) } as Response),
      });

      fireEvent.click(screen.getByRole("button", { name: /Refresh from Spotify/i }));

      await waitFor(() =>
        expect(screen.getByText("Failed to refresh uncategorized songs. Please try again.")).toBeInTheDocument()
      );
      expect(screen.getByText("Original Song-0-10-0")).toBeInTheDocument();
    });
  });
});
