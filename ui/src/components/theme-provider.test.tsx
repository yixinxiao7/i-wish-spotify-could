import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-theme-provider">{children}</div>
  ),
}));

describe("ThemeProvider", () => {
  it("passes through children", () => {
    render(
      <ThemeProvider attribute="class">
        <p>hello</p>
      </ThemeProvider>
    );
    expect(screen.getByTestId("next-theme-provider")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
