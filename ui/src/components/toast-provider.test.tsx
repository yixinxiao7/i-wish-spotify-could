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
});
