import "@testing-library/jest-dom";

process.env.NEXT_PUBLIC_SERVER_HOST = process.env.NEXT_PUBLIC_SERVER_HOST ?? "http://localhost:8000";
process.env.NEXT_PUBLIC_WEB_HOST = process.env.NEXT_PUBLIC_WEB_HOST ?? "http://localhost:3000";
process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID =
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "test-client-id";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: jest.fn(),
});

jest.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
  IBM_Plex_Mono: () => ({ variable: "font-ibm-plex-mono", className: "font-ibm-plex-mono" }),
}));

// Stub every lucide icon. A hardcoded allow-list here means any newly used
// icon resolves to undefined and fails with an opaque "Element type is
// invalid", so resolve icon names dynamically instead.
jest.mock("lucide-react", () => {
  const iconStub = () => null;
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return true;
        if (typeof prop === "symbol") return undefined;
        return iconStub;
      },
    }
  );
});
