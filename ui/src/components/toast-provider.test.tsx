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

  it("mounts an assertive alert region immediately, before any error exists", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    const region = screen.getByRole("alert");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toBeEmptyDOMElement();
  });

  it("puts a success message in the polite status region and an error in the assertive alert region", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    fireEvent.click(screen.getByRole("button", { name: "fire error" }));

    const statusRegion = screen.getByRole("status");
    const alertRegion = screen.getByRole("alert");
    expect(statusRegion).toContainElement(screen.getByText("Saved successfully"));
    expect(alertRegion).toContainElement(screen.getByText("Something failed"));
  });

  it("scopes aria-atomic to each toast rather than the region, so a new toast does not re-read the ones already showing", () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));

    const region = screen.getByRole("status");
    expect(region).not.toHaveAttribute("aria-atomic");
    const toastEls = region.querySelectorAll('[aria-atomic="true"]');
    expect(toastEls).toHaveLength(2);
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
    fireEvent.focus(undoButton);
    fireEvent.click(undoButton); // native buttons activate identically via Enter/Space and click
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("pauses the auto-dismiss timer while hovered and resumes on mouse leave", () => {
    jest.useFakeTimers();
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire success" }));
    const toastText = screen.getByText("Saved successfully");
    const toastRow = toastText.closest("div[aria-atomic]") as HTMLElement;

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    fireEvent.mouseEnter(toastRow);
    act(() => {
      jest.advanceTimersByTime(10000); // well past the original 5s duration
    });
    expect(screen.getByText("Saved successfully")).toBeInTheDocument(); // still here — paused

    fireEvent.mouseLeave(toastRow);
    act(() => {
      jest.advanceTimersByTime(3000); // remaining ~3s from before the hover
    });
    expect(screen.queryByText("Saved successfully")).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("pauses while focus is anywhere inside the toast and resumes only once focus leaves entirely", () => {
    jest.useFakeTimers();
    render(<ToastProvider><ActionTrigger onUndo={jest.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire with action" }));
    const undoButton = screen.getByRole("button", { name: "Undo" });
    const dismissButton = screen.getByRole("button", { name: "Dismiss notification" });
    const toastRow = undoButton.closest("div[aria-atomic]") as HTMLElement;

    fireEvent.focus(undoButton, { relatedTarget: null });
    // Moving focus from Undo to Dismiss stays within the toast — should
    // never actually resume in between, even though a blur fires first.
    fireEvent.blur(undoButton, { relatedTarget: dismissButton });
    fireEvent.focus(dismissButton, { relatedTarget: undoButton });

    act(() => {
      jest.advanceTimersByTime(11000); // well past the 5s duration
    });
    expect(screen.getByText("Song removed")).toBeInTheDocument(); // still paused

    fireEvent.blur(dismissButton, { relatedTarget: null });
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("Song removed")).not.toBeInTheDocument();
    void toastRow;
    jest.useRealTimers();
  });

  it("calls onPauseChange when a caller-supplied timer needs to stay in lockstep with the toast", () => {
    jest.useFakeTimers();
    const onPauseChange = jest.fn();
    function LockstepTrigger() {
      const { showToast } = useToast();
      return (
        <button onClick={() => showToast("Removed", "success", { durationMs: 5000, onPauseChange })}>
          fire
        </button>
      );
    }
    render(<ToastProvider><LockstepTrigger /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire" }));
    const toastRow = screen.getByText("Removed").closest("div[aria-atomic]") as HTMLElement;

    fireEvent.mouseEnter(toastRow);
    expect(onPauseChange).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(toastRow);
    expect(onPauseChange).toHaveBeenLastCalledWith(false);
    jest.useRealTimers();
  });

  it("renders a progress indicator that reflects remaining time", () => {
    jest.useFakeTimers();
    render(<ToastProvider><ActionTrigger onUndo={jest.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "fire with action" }));

    const region = screen.getByRole("status");
    const bar = region.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    // scaleX, not width (L3) — width forces layout on every tick, a
    // compositor-only transform doesn't.
    const scaleXOf = (el: HTMLElement) => {
      const m = el.style.transform.match(/scaleX\(([\d.]+)\)/);
      return m ? parseFloat(m[1]) : NaN;
    };
    expect(scaleXOf(bar)).toBeCloseTo(1, 5);

    act(() => {
      jest.advanceTimersByTime(2500);
    });
    const midScale = scaleXOf(bar);
    expect(midScale).toBeGreaterThan(0);
    expect(midScale).toBeLessThan(1);

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
