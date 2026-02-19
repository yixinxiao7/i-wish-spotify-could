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

  it("renders coming soon button", () => {
    render(<Landing />);
    expect(screen.getByRole("button", { name: "coming soon..." })).toBeInTheDocument();
  });
});
