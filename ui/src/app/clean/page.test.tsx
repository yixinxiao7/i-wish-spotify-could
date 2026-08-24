import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CleanPage from "./page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Clean chooser page", () => {
  beforeEach(() => {
    pushMock.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders owned playlists, pinned first", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [
          { id: "p1", name: "Alpha", owner_id: "u1", pinned: false },
          { id: "p2", name: "Beta", owner_id: "u1", pinned: true },
        ],
      }),
    });

    render(<CleanPage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Beta");
    expect(items[1]).toHaveTextContent("Alpha");
  });

  it("navigates to the playlist's cleanup route when a row is activated", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }] }),
    });

    render(<CleanPage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(pushMock).toHaveBeenCalledWith("/clean/p1");
  });

  it("pinning a playlist does not navigate", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pin")) {
        return Promise.resolve({ ok: true, json: async () => ({ pinnedIds: ["p1"] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }] }),
      });
    }) as jest.Mock;

    render(<CleanPage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Pin Alpha" }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows an empty state when the user owns no playlists", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ playlists: [] }) });

    render(<CleanPage />);
    await waitFor(() =>
      expect(screen.getByText(/don't own any playlists yet/i)).toBeInTheDocument()
    );
  });

  it("shows an error with a retry action when the list fails to load, and retry recovers", async () => {
    let shouldFail = true;
    global.fetch = jest.fn().mockImplementation(() =>
      shouldFail
        ? Promise.resolve({ ok: false })
        : Promise.resolve({
            ok: true,
            json: async () => ({ playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }] }),
          })
    );

    render(<CleanPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
  });
});
