import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ClientComponent from "./ClientComponent";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Callback client component", () => {
  beforeEach(() => {
    sessionStorage.clear();
    pushMock.mockClear();
  });

  it("redirects to login when state is missing or invalid", async () => {
    render(<ClientComponent token_expires_in={3600} state="wrong" />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("stores token expiry and redirects home when state is valid", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    render(<ClientComponent token_expires_in={3600} state="expected-state" />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(sessionStorage.getItem("oauth_state")).toBeNull();
    expect(Number(sessionStorage.getItem("token_expiry"))).toBeGreaterThan(0);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("remains stable under React.StrictMode double effects", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    render(
      <React.StrictMode>
        <ClientComponent token_expires_in={3600} state="expected-state" />
      </React.StrictMode>
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(pushMock).not.toHaveBeenCalledWith("/login");
  });

  it("redirects to login when token expiry is absent", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    render(<ClientComponent token_expires_in={undefined} state="expected-state" />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});
