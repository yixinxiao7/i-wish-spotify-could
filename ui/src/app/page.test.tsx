import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Landing from "./page";

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

  it("both tool buttons carry a description distinguishing them", () => {
    render(<Landing />);
    expect(
      screen.getByText(/sort liked songs that aren't in any playlist/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/find songs you've stopped listening to/i)
    ).toBeInTheDocument();
  });
});
