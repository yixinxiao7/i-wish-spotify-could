import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast-provider";

function Trigger() {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast("Saved successfully", "success")}>fire success</button>
      <button onClick={() => showToast("Something failed", "error")}>fire error</button>
    </>
  );
}

function ActionTrigger({ onUndo }: { onUndo: () => void }) {
  const { showToast } = useToast();
  return (
    <button
      onClick={() =>
        showToast("Song removed", "success", {
          durationMs: 5000,
          progress: true,
          action: { label: "Undo", onClick: onUndo },
        })
      }
    >
      fire with action
    </button>
  );
}

describe("ToastProvider", () => {
  it("throws when useToast is called outside a provider", () => {
    const Bare = () => {
      useToast();
      return null;
    };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow("useToast must be used within a ToastProvider");
    spy.mockRestore();
  });

  it("mounts a live region immediately, before any toast exists", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("shows a toast and lets it be dismissed manually", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Saved successfully")).not.toBeInTheDocument();
  });

  it("keeps a success and an error toast both visible at once", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    fireEvent.click(screen.getByRole("button", { name: "fire error" }));

    expect(screen.getByText("Saved successfully")).toBeInTheDocument();
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("auto-dismisses a toast after the timeout", async () => {
    jest.useFakeTimers();
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => expect(screen.queryByText("Saved successfully")).not.toBeInTheDocument());
    jest.useRealTimers();
  });

  it("behaves exactly as before when called with no options", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
  });

  it("renders an action button and invokes its handler on click, dismissing the toast", () => {
    const onUndo = jest.fn();
    render(<ToastProvider><ActionTrigger onUndo={onUndo} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire with action" }));

    expect(screen.getByText("Song removed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Song removed")).not.toBeInTheDocument();
  });

  it("invokes the action handler on keyboard activation", () => {
    const onUndo = jest.fn();
    render(<ToastProvider><ActionTrigger onUndo={onUndo} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire with action" }));

    const undoButton = screen.getByRole("button", { name: "Undo" });
    undoButton.focus();
    fireEvent.click(undoButton); // native buttons activate identically via Enter/Space and click
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("renders a progress indicator that reflects remaining time", () => {
    jest.useFakeTimers();
    render(<ToastProvider><ActionTrigger onUndo={jest.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire with action" }));

    const region = screen.getByRole("status");
    const bar = region.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    expect(bar.style.width).toBe("100%");

    act(() => {
      jest.advanceTimersByTime(2500);
    });
    const midWidth = parseFloat(bar.style.width);
    expect(midWidth).toBeGreaterThan(0);
    expect(midWidth).toBeLessThan(100);

    jest.useRealTimers();
  });

  it("progress bar has no interpolating transition under reduced motion (motion-reduce:transition-none)", () => {
    render(<ToastProvider><ActionTrigger onUndo={jest.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire with action" }));
    const region = screen.getByRole("status");
    const bar = region.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    expect(bar.className).toContain("motion-reduce:transition-none");
  });
});
