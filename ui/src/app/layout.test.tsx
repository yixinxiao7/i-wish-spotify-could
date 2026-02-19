import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import RootLayout from "./layout";

const pushMock = jest.fn();
let pathnameMock = "/";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock,
}));

const authenticated = () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  sessionStorage.setItem("token_expiry", String(future));
};

/**
 * RootLayout renders <html><body> inside RTL's container <div>, which breaks
 * React's event delegation in jsdom — jsdom intercepts events at <html> and
 * dispatches them to document instead of bubbling to the RTL root container
 * where React registers its synthetic-event listeners.
 *
 * This helper reads the React props stored on the DOM node and calls onClick
 * directly inside act(), bypassing the broken DOM event path.
 */
async function invokeOnClick(
  element: HTMLElement,
  options: { swallowError?: boolean } = {}
) {
  const propsKey = Object.keys(element).find((k) => k.startsWith("__reactProps"));
  const onClick: ((e: unknown) => Promise<void>) | undefined = propsKey
    ? ((element as any)[propsKey]?.onClick as (e: unknown) => Promise<void>) // eslint-disable-line @typescript-eslint/no-explicit-any
    : undefined;

  if (!onClick) throw new Error("No onClick found on element");

  try {
    await act(async () => {
      await onClick({});
    });
  } catch (err) {
    if (!options.swallowError) throw err;
  }
}

describe("RootLayout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    pushMock.mockClear();
    pathnameMock = "/";
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("redirects to login when token is missing on protected route", async () => {
    render(
      <RootLayout>
        <div>Child</div>
      </RootLayout>
    );

    expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("renders content when authenticated", async () => {
    authenticated();

    render(
      <RootLayout>
        <div>Child</div>
      </RootLayout>
    );

    await waitFor(() => expect(screen.getByText("Child")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "home" })).toBeInTheDocument();
  });

  it("does not force redirect on login route", async () => {
    pathnameMock = "/login";

    render(
      <RootLayout>
        <div>Login child</div>
      </RootLayout>
    );

    await waitFor(() => expect(screen.getByText("Login child")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "home" })).not.toBeInTheDocument();
  });

  describe("logout button visibility", () => {
    it("renders logout button when authenticated on a protected route", async () => {
      authenticated();
      render(<RootLayout><div>Child</div></RootLayout>);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "log out" })).toBeInTheDocument()
      );
    });

    it("does not render logout button on /login", async () => {
      pathnameMock = "/login";
      render(<RootLayout><div>Login child</div></RootLayout>);
      await waitFor(() => expect(screen.getByText("Login child")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "log out" })).not.toBeInTheDocument();
    });

    it("renders logout button on /callback (navbar not hidden there)", async () => {
      // The layout only suppresses the navbar on /login, not /callback.
      // This test documents the actual current behavior.
      pathnameMock = "/callback";
      render(<RootLayout><div>Callback child</div></RootLayout>);
      await waitFor(() => expect(screen.getByText("Callback child")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "log out" })).toBeInTheDocument();
    });
  });

  describe("logout button behavior", () => {
    it("calls DELETE to the logout endpoint", async () => {
      authenticated();
      render(<RootLayout><div>Child</div></RootLayout>);
      const button = await screen.findByRole("button", { name: "log out" });

      await invokeOnClick(button);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain("/api/oauth/logout");
      expect(options.method).toBe("DELETE");
    });

    it("clears token_expiry from sessionStorage", async () => {
      authenticated();
      render(<RootLayout><div>Child</div></RootLayout>);
      const button = await screen.findByRole("button", { name: "log out" });

      await invokeOnClick(button);

      expect(sessionStorage.getItem("token_expiry")).toBeNull();
    });

    it("redirects to /login after successful logout", async () => {
      authenticated();
      render(<RootLayout><div>Child</div></RootLayout>);
      const button = await screen.findByRole("button", { name: "log out" });

      await invokeOnClick(button);

      expect(pushMock).toHaveBeenCalledWith("/login");
    });

    it("still clears session and redirects when server returns non-ok", async () => {
      // The handler does not check response.ok, so a backend error must not
      // block the user from being logged out client-side.
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      authenticated();
      render(<RootLayout><div>Child</div></RootLayout>);
      const button = await screen.findByRole("button", { name: "log out" });

      await invokeOnClick(button);

      expect(sessionStorage.getItem("token_expiry")).toBeNull();
      expect(pushMock).toHaveBeenCalledWith("/login");
    });

    it("does not redirect and preserves session if fetch throws a network error", async () => {
      // Without a try/catch in handleLogout, a network failure leaves the user
      // unable to log out. This test documents that known gap.
      (global.fetch as jest.Mock).mockRejectedValue(new Error("network failure"));
      jest.spyOn(console, "error").mockImplementation(() => {});
      authenticated();
      render(<RootLayout><div>Child</div></RootLayout>);
      const button = await screen.findByRole("button", { name: "log out" });

      await invokeOnClick(button, { swallowError: true });

      expect(pushMock).not.toHaveBeenCalledWith("/login");
      expect(sessionStorage.getItem("token_expiry")).not.toBeNull();
    });
  });
});
