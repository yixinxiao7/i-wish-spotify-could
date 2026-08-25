import React from "react";
import { render, screen } from "@testing-library/react";
import PropagateLayout, { metadata } from "./layout";

describe("PropagateLayout", () => {
  it("exports a route-specific title", () => {
    expect(metadata.title).toBe("Propagate songs");
  });

  it("renders children through", () => {
    render(<PropagateLayout><div>Child</div></PropagateLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
