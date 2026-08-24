import React from "react";
import { render, screen } from "@testing-library/react";
import CleanLayout, { metadata } from "./layout";

describe("CleanLayout", () => {
  it("exports a route-specific title", () => {
    expect(metadata.title).toBe("Clean up playlists");
  });

  it("renders children through", () => {
    render(<CleanLayout><div>Child</div></CleanLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
