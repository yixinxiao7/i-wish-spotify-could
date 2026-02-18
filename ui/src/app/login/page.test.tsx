import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

describe("Login page", () => {
  const originalLocation = window.location;
  const getRandomValuesMock = jest.fn((array: Uint8Array) => {
    array.set([1, 2, 3, 4, 5, 6, 7, 8]);
    return array;
  });

  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = "client-123";
    process.env.NEXT_PUBLIC_WEB_HOST = "http://localhost:3000";
    Object.defineProperty(global, "crypto", {
      value: { getRandomValues: getRandomValuesMock },
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost:3000/login" },
    });
    sessionStorage.clear();
    getRandomValuesMock.mockClear();
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("stores oauth_state and redirects to spotify authorize url", async () => {
    const { default: Login } = await import("./page");
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const state = sessionStorage.getItem("oauth_state");
    expect(state).toBeTruthy();
    expect(state?.length).toBe(16);
    expect(window.location.href).toContain("https://accounts.spotify.com/authorize");
    expect(window.location.href).toContain("client_id=client-123");
    expect(window.location.href).toContain("response_type=code");
    expect(window.location.href).toContain("redirect_uri=");
    expect(window.location.href).toContain("state=");
    expect(getRandomValuesMock).toHaveBeenCalled();
  });
});
