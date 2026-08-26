import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PropagatePage from "./page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Propagate destination chooser page", () => {
  beforeEach(() => {
    pushMock.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders owned playlists as destination choices", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [
          { id: "p1", name: "Alpha", owner_id: "u1", pinned: false },
          { id: "p2", name: "Beta", owner_id: "u1", pinned: false },
        ],
      }),
    });

    render(<PropagatePage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("choosing a destination opens the source dialog, excluding the destination", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [
          { id: "p1", name: "Alpha", owner_id: "u1", pinned: false },
          { id: "p2", name: "Beta", owner_id: "u1", pinned: false },
          { id: "p3", name: "Gamma", owner_id: "u1", pinned: false },
        ],
      }),
    });

    render(<PropagatePage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));

    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
  });

  it("choosing a source navigates to the propagation working page", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [
          { id: "p1", name: "Alpha", owner_id: "u1", pinned: false },
          { id: "p2", name: "Beta", owner_id: "u1", pinned: false },
        ],
      }),
    });

    render(<PropagatePage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(pushMock).toHaveBeenCalledWith("/propagate/p1/from/p2");
  });

  it("dismissing the source dialog selects nothing and navigates nowhere", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [
          { id: "p1", name: "Alpha", owner_id: "u1", pinned: false },
          { id: "p2", name: "Beta", owner_id: "u1", pinned: false },
        ],
      }),
    });

    render(<PropagatePage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("states there is no other playlist to draw from when the user owns only the chosen destination", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playlists: [{ id: "p1", name: "Alpha", owner_id: "u1", pinned: false }],
      }),
    });

    render(<PropagatePage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));

    expect(
      await screen.findByText("You don't have another playlist to draw songs from.")
    ).toBeInTheDocument();
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

    render(<PropagatePage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
  });
});
