import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Login from "./page";
import { LOGIN_HEADLINE_VERBS } from "@/components/ui/typing-headline";

describe("Login page", () => {
  const originalLocation = window.location;
  const getRandomValuesMock = jest.fn((array: Uint8Array) => {
    array.set([1, 2, 3, 4, 5, 6, 7, 8]);
    return array;
  });
  const replaceMock = jest.fn();

  beforeEach(() => {
    // client_id is read from process.env at module-evaluation time (this
    // file statically imports "./page" once), so it's fixed to whatever
    // jest.setup.ts set before this suite ever ran, not what's set here.
    Object.defineProperty(global, "crypto", {
      value: { getRandomValues: getRandomValuesMock },
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "http://127.0.0.1:3000/login",
        origin: "http://127.0.0.1:3000",
        hostname: "127.0.0.1",
        replace: replaceMock,
      },
    });
    sessionStorage.clear();
    getRandomValuesMock.mockClear();
    replaceMock.mockClear();
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("names the heading with the full sentence around the first cycling verb", () => {
    render(<Login />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: `better ${LOGIN_HEADLINE_VERBS[0]} your songs`,
      })
    ).toBeInTheDocument();
  });

  it("stores oauth_state and redirects to spotify authorize url", () => {
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const state = sessionStorage.getItem("oauth_state");
    expect(state).toBeTruthy();
    expect(state?.length).toBe(16);
    expect(window.location.href).toContain("https://accounts.spotify.com/authorize");
    expect(window.location.href).toContain("client_id=test-client-id");
    expect(window.location.href).toContain("response_type=code");
    expect(window.location.href).toContain(
      `redirect_uri=${encodeURIComponent("http://127.0.0.1:3000/callback")}`
    );
    expect(window.location.href).toContain("state=");
    expect(getRandomValuesMock).toHaveBeenCalled();
  });

  it("stores the redirect_uri matching the current origin", () => {
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(sessionStorage.getItem("oauth_redirect_uri")).toBe("http://127.0.0.1:3000/callback");
  });

  it("derives a different redirect_uri when the origin differs", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://i-wish-spotify-could.vercel.app/login",
        origin: "https://i-wish-spotify-could.vercel.app",
        hostname: "i-wish-spotify-could.vercel.app",
        replace: replaceMock,
      },
    });
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(window.location.href).toContain(
      `redirect_uri=${encodeURIComponent("https://i-wish-spotify-could.vercel.app/callback")}`
    );
    expect(sessionStorage.getItem("oauth_redirect_uri")).toBe(
      "https://i-wish-spotify-could.vercel.app/callback"
    );
  });

  it("does not canonicalize a 127.0.0.1 visit", () => {
    render(<Login />);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does not canonicalize a deployed https origin", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://i-wish-spotify-could.vercel.app/login",
        origin: "https://i-wish-spotify-could.vercel.app",
        hostname: "i-wish-spotify-could.vercel.app",
        replace: replaceMock,
      },
    });
    render(<Login />);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects a localhost visit to the equivalent 127.0.0.1 origin, since Spotify rejects plain-HTTP localhost redirect URIs", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "http://localhost:3000/login",
        origin: "http://localhost:3000",
        hostname: "localhost",
        replace: replaceMock,
      },
    });
    render(<Login />);

    expect(replaceMock).toHaveBeenCalledWith("http://127.0.0.1:3000/login");
  });
});
