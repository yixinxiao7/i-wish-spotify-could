import React from "react";
import { render, screen } from "@testing-library/react";
import OrganizeLayout, { metadata } from "./layout";

describe("OrganizeLayout", () => {
  it("exports a route-specific title", () => {
    expect(metadata.title).toBe("Organize");
  });

  it("renders children through", () => {
    render(<OrganizeLayout><div>Child</div></OrganizeLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
