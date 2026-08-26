import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

import { useDeferredRowAction } from "./use-deferred-row-action";
import { ToastProvider } from "@/components/toast-provider";

interface Row {
  id: string;
  name: string;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ToastProvider, null, children);
}

describe("useDeferredRowAction", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("performs the action once the window elapses", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const perform = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDeferredRowAction<Row>({
          windowMs: 10000,
          perform,
          buildToastMessage: (row) => `Removed "${row.name}"`,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    act(() => {
      result.current.trigger({ id: "s1", name: "Song One" });
    });
    expect(result.current.pendingIds.has("s1")).toBe(true);
    expect(perform).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => expect(perform).toHaveBeenCalledWith({ id: "s1", name: "Song One" }));
  });

  it("undo before the window elapses performs nothing", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const perform = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDeferredRowAction<Row>({
          windowMs: 10000,
          perform,
          buildToastMessage: (row) => `Removed "${row.name}"`,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    act(() => {
      result.current.trigger({ id: "s1", name: "Song One" });
    });
    act(() => {
      result.current.undo("s1");
    });
    expect(result.current.pendingIds.has("s1")).toBe(false);

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(perform).not.toHaveBeenCalled();
  });

  it("hover/focus pause holds the timer, and leaving resumes it for the remaining time", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const perform = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDeferredRowAction<Row>({
          windowMs: 10000,
          perform,
          buildToastMessage: (row) => `Removed "${row.name}"`,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    act(() => {
      result.current.trigger({ id: "s1", name: "Song One" });
    });

    const toastRow = screen.getByText('Removed "Song One"').closest("div[aria-atomic]") as HTMLElement;

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    fireEvent.mouseEnter(toastRow);
    act(() => {
      jest.advanceTimersByTime(20000); // well past the original window
    });
    expect(perform).not.toHaveBeenCalled(); // paused — never fired

    fireEvent.mouseLeave(toastRow);
    act(() => {
      jest.advanceTimersByTime(7000); // ~6s remained from before the hover
    });

    await waitFor(() => expect(perform).toHaveBeenCalledWith({ id: "s1", name: "Song One" }));
  });

  it("flushes a paused entry on unmount rather than dropping it", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const perform = jest.fn().mockResolvedValue(undefined);

    function Harness() {
      const { trigger } = useDeferredRowAction<Row>({
        windowMs: 10000,
        perform,
        buildToastMessage: (row) => `Removed "${row.name}"`,
        onError: jest.fn(),
      });
      React.useEffect(() => {
        trigger({ id: "s1", name: "Song One" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }

    const { unmount } = render(React.createElement(ToastProvider, null, React.createElement(Harness)));

    const toastRow = screen.getByText('Removed "Song One"').closest("div[aria-atomic]") as HTMLElement;
    fireEvent.mouseEnter(toastRow);

    unmount();

    expect(perform).toHaveBeenCalledWith({ id: "s1", name: "Song One" }, { keepalive: true });
  });

  it("gives each pending row its own independent window", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const perform = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useDeferredRowAction<Row>({
          windowMs: 10000,
          perform,
          buildToastMessage: (row) => `Removed "${row.name}"`,
          onError: jest.fn(),
        }),
      { wrapper }
    );

    act(() => {
      result.current.trigger({ id: "s1", name: "Song One" });
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.trigger({ id: "s2", name: "Song Two" });
    });
    act(() => {
      result.current.undo("s1");
    });

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => expect(perform).toHaveBeenCalledWith({ id: "s2", name: "Song Two" }));
    expect(perform).not.toHaveBeenCalledWith({ id: "s1", name: "Song One" });
  });

  it("rolls a row back out of pendingIds when the action fails", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const perform = jest.fn().mockRejectedValue(new Error("failed"));
    const onError = jest.fn();
    const { result } = renderHook(
      () =>
        useDeferredRowAction<Row>({
          windowMs: 10000,
          perform,
          buildToastMessage: (row) => `Removed "${row.name}"`,
          onError,
        }),
      { wrapper }
    );

    act(() => {
      result.current.trigger({ id: "s1", name: "Song One" });
    });

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => expect(onError).toHaveBeenCalledWith({ id: "s1", name: "Song One" }, expect.any(Error)));
    expect(result.current.pendingIds.has("s1")).toBe(false);
  });
});
