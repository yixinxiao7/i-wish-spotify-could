import React from "react";
import { render, screen } from "@testing-library/react";
import PropagateSongsLayout, { metadata } from "./layout";

describe("PropagateSongsLayout", () => {
  it("exports a route-specific title", () => {
    expect(metadata.title).toBe("Propagate playlist");
  });

  it("renders children through", () => {
    render(<PropagateSongsLayout><div>Child</div></PropagateSongsLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
