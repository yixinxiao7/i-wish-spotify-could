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
    global.fetch = jest.fn();
  });

  it("exchanges the code and redirects home when state is valid", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    sessionStorage.setItem("oauth_redirect_uri", "http://localhost:3000/callback");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ expires_in: 3600 }),
    });

    render(<ClientComponent code="code-1" state="expected-state" error={undefined} />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "code-1", redirect_uri: "http://localhost:3000/callback" }),
      })
    );
    expect(sessionStorage.getItem("oauth_state")).toBeNull();
    expect(sessionStorage.getItem("oauth_redirect_uri")).toBeNull();
    expect(Number(sessionStorage.getItem("token_expiry"))).toBeGreaterThan(0);
  });

  it("shows the unverifiable-login error and issues no fetch when state does not match", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    render(<ClientComponent code="code-1" state="wrong" error={undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("This login could not be verified.")
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the unverifiable-login error when no state was ever stored", async () => {
    render(<ClientComponent code="code-1" state="anything" error={undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("This login could not be verified.")
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows the declined-consent error and issues no fetch when the provider returns an error", async () => {
    render(<ClientComponent code={undefined} state={undefined} error="access_denied" />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Authorization was declined.")
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows the incomplete-response error and issues no fetch when no code is present", async () => {
    render(<ClientComponent code={undefined} state="some-state" error={undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The login response from Spotify was incomplete."
      )
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows the exchange-failed error when the token exchange fails and no session exists", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 500,
      json: async () => ({ message: "error" }),
    });

    render(<ClientComponent code="code-1" state="expected-state" error={undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Login could not be completed.")
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the exchange-failed error on a network failure", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));

    render(<ClientComponent code="code-1" state="expected-state" error={undefined} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Login could not be completed.")
    );
  });

  it("navigates home without fetching when a valid session already exists (refresh-after-success)", async () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
    sessionStorage.setItem("token_expiry", String(futureExpiry));

    render(<ClientComponent code="already-used-code" state="whatever" error={undefined} />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not treat an expired session as valid", async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 10;
    sessionStorage.setItem("token_expiry", String(pastExpiry));
    sessionStorage.setItem("oauth_state", "expected-state");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ expires_in: 3600 }),
    });

    render(<ClientComponent code="code-1" state="expected-state" error={undefined} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it("performs at most one exchange under double effect invocation (StrictMode)", async () => {
    sessionStorage.setItem("oauth_state", "expected-state");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ expires_in: 3600 }),
    });

    render(
      <React.StrictMode>
        <ClientComponent code="code-1" state="expected-state" error={undefined} />
      </React.StrictMode>
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries from an error state by navigating to /login", async () => {
    render(<ClientComponent code={undefined} state={undefined} error="access_denied" />);

    const retryButton = await screen.findByRole("button", { name: "Try again" });
    retryButton.click();

    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
