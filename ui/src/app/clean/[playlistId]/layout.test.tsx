import React from "react";
import { render, screen } from "@testing-library/react";
import CleanPlaylistLayout, { metadata } from "./layout";

describe("CleanPlaylistLayout", () => {
  it("exports a route-specific title", () => {
    expect(metadata.title).toBe("Clean playlist");
  });

  it("renders children through", () => {
    render(<CleanPlaylistLayout><div>Child</div></CleanPlaylistLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
