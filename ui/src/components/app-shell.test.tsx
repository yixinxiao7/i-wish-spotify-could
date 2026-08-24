import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppShell } from "./app-shell";

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

describe("AppShell", () => {
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
      <AppShell>
        <div>Child</div>
      </AppShell>
    );

    // The themed auth shell (M12) rather than a bare fragment.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Redirecting to login…")).toBeInTheDocument();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("renders content when authenticated", async () => {
    authenticated();

    render(
      <AppShell>
        <div>Child</div>
      </AppShell>
    );

    await waitFor(() => expect(screen.getByText("Child")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "home" })).toBeInTheDocument();
  });

  it("does not force redirect on login route", async () => {
    pathnameMock = "/login";

    render(
      <AppShell>
        <div>Login child</div>
      </AppShell>
    );

    await waitFor(() => expect(screen.getByText("Login child")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "home" })).not.toBeInTheDocument();
  });

  describe("logout button visibility", () => {
    it("renders logout button when authenticated on a protected route", async () => {
      authenticated();
      render(<AppShell><div>Child</div></AppShell>);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "log out" })).toBeInTheDocument()
      );
    });

    it("does not render logout button on /login", async () => {
      pathnameMock = "/login";
      render(<AppShell><div>Login child</div></AppShell>);
      await waitFor(() => expect(screen.getByText("Login child")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "log out" })).not.toBeInTheDocument();
    });

    it("renders logout button on /callback (navbar not hidden there)", async () => {
      // The shell only suppresses the navbar on /login, not /callback.
      // This test documents the actual current behavior.
      pathnameMock = "/callback";
      render(<AppShell><div>Callback child</div></AppShell>);
      await waitFor(() => expect(screen.getByText("Callback child")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "log out" })).toBeInTheDocument();
    });
  });

  describe("logout button behavior", () => {
    it("calls DELETE to the logout endpoint", async () => {
      authenticated();
      render(<AppShell><div>Child</div></AppShell>);
      const button = await screen.findByRole("button", { name: "log out" });

      fireEvent.click(button);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain("/api/oauth/logout");
      expect(options.method).toBe("DELETE");
    });

    it("clears token_expiry from sessionStorage", async () => {
      authenticated();
      render(<AppShell><div>Child</div></AppShell>);
      const button = await screen.findByRole("button", { name: "log out" });

      fireEvent.click(button);

      await waitFor(() => expect(sessionStorage.getItem("token_expiry")).toBeNull());
    });

    it("redirects to /login after successful logout", async () => {
      authenticated();
      render(<AppShell><div>Child</div></AppShell>);
      const button = await screen.findByRole("button", { name: "log out" });

      fireEvent.click(button);

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    });

    it("still clears session and redirects when server returns non-ok", async () => {
      // The handler does not check response.ok, so a backend error must not
      // block the user from being logged out client-side.
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      authenticated();
      render(<AppShell><div>Child</div></AppShell>);
      const button = await screen.findByRole("button", { name: "log out" });

      fireEvent.click(button);

      await waitFor(() => expect(sessionStorage.getItem("token_expiry")).toBeNull());
      expect(pushMock).toHaveBeenCalledWith("/login");
    });

    it("does not redirect and preserves session if fetch throws a network error", async () => {
      // Without a try/catch in handleLogout, a network failure leaves the user
      // unable to log out. This test documents that known gap. fireEvent.click
      // doesn't surface the handler's own rejected promise, so invoke the
      // onClick prop directly and swallow it — otherwise it fails the test as
      // an unhandled rejection instead of exercising the gap.
      (global.fetch as jest.Mock).mockRejectedValue(new Error("network failure"));
      jest.spyOn(console, "error").mockImplementation(() => {});
      authenticated();
      render(<AppShell><div>Child</div></AppShell>);
      const button = await screen.findByRole("button", { name: "log out" });

      const propsKey = Object.keys(button).find((k) => k.startsWith("__reactProps"));
      const onClick = propsKey ? (button as any)[propsKey]?.onClick : undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      await act(async () => {
        await onClick({}).catch(() => {});
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalledWith("/login");
      expect(sessionStorage.getItem("token_expiry")).not.toBeNull();
    });
  });
});
