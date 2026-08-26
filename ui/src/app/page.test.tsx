import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Landing from "./page";
import { LANDING_HEADLINE_PHRASES } from "@/components/ui/typing-headline";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Landing page", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("routes to organize from categorize button", () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole("button", { name: "categorize songs" }));
    expect(pushMock).toHaveBeenCalledWith("/organize");
  });

  it("routes to clean from the clean up playlists button", () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole("button", { name: "clean up playlists" }));
    expect(pushMock).toHaveBeenCalledWith("/clean");
  });

  it("routes to propagate from the propagate songs button", () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole("button", { name: "propagate songs" }));
    expect(pushMock).toHaveBeenCalledWith("/propagate");
  });

  it("exposes the first headline phrase as the accessible heading name", () => {
    render(<Landing />);
    expect(
      screen.getByRole("heading", { level: 1, name: LANDING_HEADLINE_PHRASES[0] })
    ).toBeInTheDocument();
  });

  it("all three tool buttons carry a description distinguishing them", () => {
    render(<Landing />);
    expect(
      screen.getByText(/sort liked songs that aren't in any playlist/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/find songs you've stopped listening to/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add songs from one playlist into another/i)
    ).toBeInTheDocument();
  });
});
