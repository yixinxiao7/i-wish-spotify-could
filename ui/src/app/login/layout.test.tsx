import React from "react";
import { render, screen } from "@testing-library/react";
import LoginLayout, { metadata } from "./layout";

describe("LoginLayout", () => {
  it("exports a route-specific title", () => {
    expect(metadata.title).toBe("Log in");
  });

  it("renders children through", () => {
    render(<LoginLayout><div>Child</div></LoginLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
