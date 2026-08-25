import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PropagateSongsPage from "./page";
import { ToastProvider } from "@/components/toast-provider";

jest.mock("next/navigation", () => ({
  useParams: () => ({ destinationId: "dest1", sourceId: "src1" }),
}));

jest.mock("@/components/ui/song", () => ({
  // Matches the real SongCard's shape closely enough for page-level
  // assertions: a real list item, a plus control when onAdd is present,
  // and — crucially for this page — no add-to-playlists trigger at all
  // when showAddToPlaylists is false.
  SongCard: ({
    id,
    name,
    onAdd,
    showAddToPlaylists,
  }: {
    id: string;
    name: string;
    onAdd?: (songId: string) => void;
    showAddToPlaylists?: boolean;
  }) => (
    <li>
      <h2>{name}</h2>
      {onAdd && <button onClick={() => onAdd(id)}>{`add ${name}`}</button>}
      {showAddToPlaylists !== false && <button>add to playlists</button>}
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
  rawTotal = total,
  playlistName = "Source",
  affinityAvailable = true,
  affinityReason = null as string | null,
  addImpl,
  getStatus = 200,
}: {
  songs?: MockSong[];
  total?: number;
  rawTotal?: number;
  playlistName?: string;
  affinityAvailable?: boolean;
  affinityReason?: string | null;
  addImpl?: (init?: RequestInit) => Promise<Response>;
  getStatus?: number;
} = {}) {
  return jest.fn((input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") {
      if (addImpl) return addImpl(init);
      return Promise.resolve({ ok: true, json: async () => ({ message: "ok" }) }) as Promise<Response>;
    }
    if (getStatus === 404) {
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) as Promise<Response>;
    }
    if (getStatus !== 200) {
      return Promise.resolve({ ok: false, status: getStatus, json: async () => ({}) }) as Promise<Response>;
    }
    const parsed = new URL(url);
    const excludePlaylistId = parsed.searchParams.get("exclude_playlist_id");
    if (!excludePlaylistId) {
      // The lightweight raw-total check the page issues when the
      // exclusion-applied total is 0, to tell "source is empty" apart
      // from "everything is already in the destination".
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          playlist: { id: "src1", name: playlistName },
          songs: [],
          total: rawTotal,
          affinity: { available: affinityAvailable, reason: affinityReason },
        }),
      }) as Promise<Response>;
    }
    const offset = Number(parsed.searchParams.get("offset") ?? "0");
    const limit = Number(parsed.searchParams.get("limit") ?? "10");
    const page = songs.slice(offset, offset + limit);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        playlist: { id: "src1", name: playlistName },
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
      <PropagateSongsPage />
    </ToastProvider>
  );
}

describe("Propagate songs page", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (jest.isMockFunction(setTimeout)) jest.useRealTimers();
  });

  it("requests the source playlist with exclude_playlist_id set to the destination", async () => {
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    const call = (global.fetch as jest.Mock).mock.calls.find(([input]) =>
      String(input).includes("exclude_playlist_id")
    );
    expect(call).toBeDefined();
    expect(String(call![0])).toContain("/api/playlists/src1/songs");
    expect(String(call![0])).toContain("exclude_playlist_id=dest1");
  });

  it("renders rows with a plus control and no add-to-playlists trigger", async () => {
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "add Song One" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "add to playlists" })).not.toBeInTheDocument();
  });

  it("adds a song after the window elapses, with the right request body", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("add Song One"));
    expect(screen.queryByText("Song One")).not.toBeInTheDocument(); // hidden immediately

    act(() => {
      jest.advanceTimersByTime(11000);
    });

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === "POST");
      expect(postCall).toBeDefined();
      expect(postCall![1].body).toContain('"songId":"s1"');
      expect(postCall![1].body).toContain('"playlistIds":["dest1"]');
    });
  });

  it("undo cancels the pending add", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({ songs: [song("s1", "Song One")], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("add Song One"));
    fireEvent.click(await screen.findByText("Undo"));

    act(() => {
      jest.advanceTimersByTime(11000);
    });

    const postCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "POST");
    expect(postCalls).toHaveLength(0);
    expect(screen.getByText("Song One")).toBeInTheDocument();
  });

  it("changing the sort refetches from page one", async () => {
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
      expect(String(last![0])).toContain("sort=added_asc");
      expect(String(last![0])).toContain("offset=0");
    });
  });

  it("changing the page size refetches from page one", async () => {
    global.fetch = createFetchMock({
      songs: Array.from({ length: 15 }, (_, i) => song(`s${i}`, `Song ${i}`)),
      total: 15,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Songs per page"));
    fireEvent.click(screen.getByText("25"));

    await waitFor(() => {
      const last = (global.fetch as jest.Mock).mock.calls.at(-1);
      expect(String(last![0])).toContain("limit=25");
      expect(String(last![0])).toContain("offset=0");
    });
  });

  it("explains why least-listened sorting is unavailable, per reason", async () => {
    global.fetch = createFetchMock({
      songs: [song("s1", "Song One")],
      total: 1,
      affinityAvailable: false,
      affinityReason: "missing_scope",
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/log out and back in to enable it/i)).toBeInTheDocument()
    );
  });

  it("shows the pair-unavailable state on 404", async () => {
    global.fetch = createFetchMock({ getStatus: 404 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/This playlist pair is unavailable/i)).toBeInTheDocument()
    );
  });

  it("shows 'nothing left to propagate' when every source song is already in the destination", async () => {
    global.fetch = createFetchMock({ songs: [], total: 0, rawTotal: 5 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Nothing left to propagate/i)).toBeInTheDocument()
    );
  });

  it("shows 'this playlist is empty' when the source genuinely has no songs", async () => {
    global.fetch = createFetchMock({ songs: [], total: 0, rawTotal: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText("This playlist is empty.")).toBeInTheDocument());
  });

  it("shows a permission-denied message and restores the row on 403", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({
      songs: [song("s1", "Song One")],
      total: 1,
      addImpl: async () => ({ ok: false, status: 403, json: async () => ({}) } as Response),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("add Song One"));
    act(() => {
      jest.advanceTimersByTime(11000);
    });

    expect(
      await screen.findByText('The playlist could not be modified — "Song One" was not added.')
    ).toBeInTheDocument();
    expect(screen.getByText("Song One")).toBeInTheDocument();
  });

  it("shows a generic failure message and restores the row on other failures", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({
      songs: [song("s1", "Song One")],
      total: 1,
      addImpl: async () => ({ ok: false, status: 500, json: async () => ({}) } as Response),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());

    fireEvent.click(screen.getByText("add Song One"));
    act(() => {
      jest.advanceTimersByTime(11000);
    });

    expect(await screen.findByText('Failed to add "Song One". Please try again.')).toBeInTheDocument();
    expect(screen.getByText("Song One")).toBeInTheDocument();
  });

  it("steps back a page when a pending add empties the current (later) page", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = createFetchMock({
      songs: Array.from({ length: 11 }, (_, i) => song(`s${i}`, `Song ${i}`)),
      total: 11,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Go to next page"));
    await waitFor(() => expect(screen.getByText("Song 10")).toBeInTheDocument());

    fireEvent.click(screen.getByText("add Song 10"));

    await waitFor(() => expect(screen.getByText("Song 0")).toBeInTheDocument());
  });

  it("surfaces the server's load-failure detail with a working retry", async () => {
    let shouldFail = true;
    global.fetch = jest.fn().mockImplementation((input: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve({ ok: true, json: async () => ({}) });
      if (shouldFail) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: async () => ({ detail: "Spotify is rate limiting this app right now." }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          playlist: { id: "src1", name: "Source" },
          songs: [song("s1", "Song One")],
          total: 1,
          affinity: { available: true, reason: null },
        }),
      });
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Spotify is rate limiting this app right now.")).toBeInTheDocument()
    );

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());
  });
});
