import React from "react";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

jest.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

describe("RootLayout", () => {
  it("exports page metadata with a title and description", () => {
    expect(metadata.title).toEqual({
      default: "I Wish Spotify Could",
      template: "%s · I Wish Spotify Could",
    });
    expect(metadata.description).toBeTruthy();
  });

  it("renders children inside AppShell", () => {
    // RootLayout renders <html><body> inside RTL's container <div>, which
    // triggers a harmless DOM-nesting warning under jsdom — expected here
    // since this is the one place in the app the real <html> tag is used.
    render(
      <RootLayout>
        <div>Page content</div>
      </RootLayout>
    );

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
