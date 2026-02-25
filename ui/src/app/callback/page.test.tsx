import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("./ClientComponent", () => ({
  __esModule: true,
  default: ({ token_expires_in, state }: { token_expires_in?: number; state?: string }) => (
    <div data-testid="callback-client">
      {String(token_expires_in)}|{state}
    </div>
  ),
}));

describe("Callback page", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SERVER_HOST = "http://localhost:8000";
    global.fetch = jest.fn();
  });

  it("fetches token expiry and renders client component", async () => {
    const { default: CallbackPage } = await import("./page");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ expires_in: 3600 }),
    });

    const element = await CallbackPage({
      searchParams: Promise.resolve({ code: "code-1", state: "state-1" }),
    });
    render(element);

    expect(global.fetch).toHaveBeenCalledWith("http://localhost:8000/api/oauth/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "code-1" }),
    });
    expect(screen.getByTestId("callback-client")).toHaveTextContent("3600|state-1");
  });

  it("passes undefined expiry when oauth exchange fails", async () => {
    const { default: CallbackPage } = await import("./page");
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 500,
      json: async () => ({ message: "error" }),
    });

    const element = await CallbackPage({
      searchParams: Promise.resolve({ code: "code-2", state: "state-2" }),
    });
    render(element);

    expect(screen.getByTestId("callback-client")).toHaveTextContent("undefined|state-2");
  });
});
