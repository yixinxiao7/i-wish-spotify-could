import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("RootLayout", () => {
  beforeEach(() => {
    sessionStorage.clear();
    pushMock.mockClear();
    pathnameMock = "/";
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
    const future = Math.floor(Date.now() / 1000) + 3600;
    sessionStorage.setItem("token_expiry", String(future));

    render(
      <RootLayout>
        <div>Child</div>
      </RootLayout>
    );

    await waitFor(() => expect(screen.getByText("Child")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });
});
