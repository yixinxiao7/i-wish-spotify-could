import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("./ClientComponent", () => ({
  __esModule: true,
  default: ({ code, state, error }: { code?: string; state?: string; error?: string }) => (
    <div data-testid="callback-client">
      {String(code)}|{String(state)}|{String(error)}
    </div>
  ),
}));

describe("Callback page", () => {
  it("forwards code, state, and error to the client component without fetching", async () => {
    global.fetch = jest.fn();
    const { default: CallbackPage } = await import("./page");

    const element = await CallbackPage({
      searchParams: Promise.resolve({ code: "code-1", state: "state-1" }),
    });
    render(element);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("callback-client")).toHaveTextContent("code-1|state-1|undefined");
  });

  it("forwards a provider error param", async () => {
    const { default: CallbackPage } = await import("./page");

    const element = await CallbackPage({
      searchParams: Promise.resolve({ error: "access_denied" }),
    });
    render(element);

    expect(screen.getByTestId("callback-client")).toHaveTextContent(
      "undefined|undefined|access_denied"
    );
  });
});
