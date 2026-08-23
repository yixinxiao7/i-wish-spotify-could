import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OrganizePage from "./page";
import { ToastProvider } from "@/components/toast-provider";

// Unlike page.test.tsx, this file renders the real SongCard so we can verify
// that pinning a playlist from one song's dialog is reflected in another
// song's dialog, per the "Two song cards open the same playlist set" scenario.
describe("Organize page — pin sharing across song cards", () => {
  const playlist = { id: "p1", name: "Road Trip", owner_id: "u1", pinned: false };

  beforeEach(() => {
    global.fetch = jest.fn((input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/playlists/pin")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ pinnedIds: ["p1"] }),
        }) as Promise<Response>;
      }
      if (url.includes("/api/playlists")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ playlists: [playlist] }),
        }) as Promise<Response>;
      }
      if (url.includes("/api/songs/total")) {
        return Promise.resolve({ ok: true, json: async () => ({ total: 2 }) }) as Promise<Response>;
      }
      if (url.includes("/api/songs")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            songs: [
              { id: "s1", name: "Song One", artists: "Artist A", album: "Album A" },
              { id: "s2", name: "Song Two", artists: "Artist B", album: "Album B" },
            ],
          }),
        }) as Promise<Response>;
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    }) as jest.Mock;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows a playlist pinned from one song's dialog as pinned in another song's dialog", async () => {
    render(<ToastProvider><OrganizePage /></ToastProvider>);

    await waitFor(() => expect(screen.getByText("Song One")).toBeInTheDocument());
    expect(screen.getByText("Song Two")).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", { name: "add to playlists" });
    fireEvent.click(addButtons[0]);

    const firstDialog = await screen.findByRole("dialog");
    fireEvent.click(within(firstDialog).getByRole("button", { name: "Pin Road Trip" }));
    await waitFor(() =>
      expect(within(firstDialog).getByRole("button", { name: "Unpin Road Trip" })).toBeInTheDocument()
    );

    fireEvent.keyDown(firstDialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(addButtons[1]);
    const secondDialog = await screen.findByRole("dialog");
    expect(within(secondDialog).getByRole("button", { name: "Unpin Road Trip" })).toBeInTheDocument();
  });
});
