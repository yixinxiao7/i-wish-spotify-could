import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PlaylistsProvider, usePlaylists } from "./playlists-provider";

const Consumer: React.FC = () => {
  const { playlists, loading, error, togglePin, refetch } = usePlaylists();
  return (
    <div>
      <span>loading:{String(loading)}</span>
      <span>error:{error ?? "none"}</span>
      <ul>
        {playlists.map((p) => (
          <li key={p.id}>{p.id}:{String(!!p.pinned)}</li>
        ))}
      </ul>
      <button onClick={() => togglePin("p1", true)}>pin p1</button>
      <button onClick={() => togglePin("p1", false)}>unpin p1</button>
      <button onClick={() => refetch()}>retry</button>
    </div>
  );
};

describe("PlaylistsProvider", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches playlists on mount", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ playlists: [{ id: "p1", name: "P1", owner_id: "u1", pinned: false }] }),
    });

    render(
      <PlaylistsProvider>
        <Consumer />
      </PlaylistsProvider>
    );

    await waitFor(() => expect(screen.getByText("loading:false")).toBeInTheDocument());
    expect(screen.getByText("p1:false")).toBeInTheDocument();
  });

  it("surfaces a fetch error", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    render(
      <PlaylistsProvider>
        <Consumer />
      </PlaylistsProvider>
    );

    await waitFor(() => expect(screen.getByText("error:Failed to load playlists.")).toBeInTheDocument());
  });

  it("optimistically pins and reconciles against the server response", async () => {
    (global.fetch as jest.Mock) = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pin")) {
        return Promise.resolve({ ok: true, json: async () => ({ pinnedIds: ["p1"] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ playlists: [{ id: "p1", name: "P1", owner_id: "u1", pinned: false }] }),
      });
    });

    render(
      <PlaylistsProvider>
        <Consumer />
      </PlaylistsProvider>
    );

    await waitFor(() => expect(screen.getByText("p1:false")).toBeInTheDocument());
    screen.getByText("pin p1").click();

    await waitFor(() => expect(screen.getByText("p1:true")).toBeInTheDocument());
  });

  it("shares pin state across multiple consumers rendered at once", async () => {
    (global.fetch as jest.Mock) = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pin")) {
        return Promise.resolve({ ok: true, json: async () => ({ pinnedIds: ["p1"] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ playlists: [{ id: "p1", name: "P1", owner_id: "u1", pinned: false }] }),
      });
    });

    render(
      <PlaylistsProvider>
        <Consumer />
        <Consumer />
      </PlaylistsProvider>
    );

    await waitFor(() => expect(screen.getAllByText("p1:false")).toHaveLength(2));
    screen.getAllByText("pin p1")[0].click();

    await waitFor(() => expect(screen.getAllByText("p1:true")).toHaveLength(2));
  });

  it("reverts and shows an error when the pin request fails", async () => {
    (global.fetch as jest.Mock) = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pin")) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ playlists: [{ id: "p1", name: "P1", owner_id: "u1", pinned: false }] }),
      });
    });

    render(
      <PlaylistsProvider>
        <Consumer />
      </PlaylistsProvider>
    );

    await waitFor(() => expect(screen.getByText("p1:false")).toBeInTheDocument());
    screen.getByText("pin p1").click();

    await waitFor(() => expect(screen.getByText("p1:false")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText("error:Failed to update pin. Please try again.")).toBeInTheDocument()
    );
  });

  it("refetch re-runs the fetch and recovers from a prior error", async () => {
    let shouldFail = true;
    global.fetch = jest.fn().mockImplementation(() =>
      shouldFail
        ? Promise.resolve({ ok: false })
        : Promise.resolve({
            ok: true,
            json: async () => ({ playlists: [{ id: "p1", name: "P1", owner_id: "u1", pinned: false }] }),
          })
    );

    render(
      <PlaylistsProvider>
        <Consumer />
      </PlaylistsProvider>
    );

    await waitFor(() => expect(screen.getByText("error:Failed to load playlists.")).toBeInTheDocument());

    shouldFail = false;
    screen.getByText("retry").click();

    await waitFor(() => expect(screen.getByText("error:none")).toBeInTheDocument());
    expect(screen.getByText("p1:false")).toBeInTheDocument();
  });
});
