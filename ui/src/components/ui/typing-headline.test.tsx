import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  LANDING_HEADLINE_PHRASES,
  LOGIN_HEADLINE_VERBS,
  TypingHeadline,
} from "./typing-headline";

const TYPE_MS = 55;
const ERASE_MS = 30;
const HOLD_MS = 1800;

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function visibleText(heading: HTMLElement) {
  const span = heading.querySelector("span[aria-hidden='true']");
  return span?.textContent ?? "";
}

// Each hop of the reveal chain (a fired timer's callback triggers a
// state update, whose effect schedules the *next* timer) needs its own
// advanceTimersByTimeAsync call — a timer newly scheduled mid-call does
// not get a chance to fire within that same call, however much budget
// remains. A leading 0ms advance drains any such pending-but-not-yet-
// fired hop (e.g. the zero-delay typing-complete -> holding transition)
// before the real, timed advance runs, so that advance's own timer is
// already "originally pending" and reliably fires in one hop.
async function tick(stepMs: number, times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(stepMs);
    });
  }
}

describe("TypingHeadline", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reveals the active phrase one character at a time", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });

    expect(visibleText(heading)).toBe("");

    await tick(TYPE_MS, 1);
    expect(visibleText(heading)).toBe(LANDING_HEADLINE_PHRASES[0].slice(0, 1));

    await tick(TYPE_MS, 4);
    expect(visibleText(heading)).toBe(LANDING_HEADLINE_PHRASES[0].slice(0, 5));

    await tick(TYPE_MS, LANDING_HEADLINE_PHRASES[0].length - 5);
    expect(visibleText(heading)).toBe(LANDING_HEADLINE_PHRASES[0]);
  });

  it("holds the complete phrase before erasing", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });
    const phrase = LANDING_HEADLINE_PHRASES[0];

    await tick(TYPE_MS, phrase.length);
    expect(visibleText(heading)).toBe(phrase);

    await tick(HOLD_MS - 100, 1);
    expect(visibleText(heading)).toBe(phrase);
  });

  it("erases the phrase one character at a time from the end", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });
    const phrase = LANDING_HEADLINE_PHRASES[0];

    await tick(TYPE_MS, phrase.length);
    await tick(HOLD_MS, 1);
    expect(visibleText(heading)).toBe(phrase);

    await tick(ERASE_MS, 1);
    expect(visibleText(heading)).toBe(phrase.slice(0, -1));

    await tick(ERASE_MS, phrase.length - 1);
    expect(visibleText(heading)).toBe("");
  });

  it("rotates through every phrase in order and wraps back to the first", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });

    for (const phrase of LANDING_HEADLINE_PHRASES) {
      await tick(TYPE_MS, phrase.length);
      expect(visibleText(heading)).toBe(phrase);
      await tick(HOLD_MS, 1);
      await tick(ERASE_MS, phrase.length);
      expect(visibleText(heading)).toBe("");
      // One more hop consumes the erase-complete -> next-phrase transition
      // itself, which fires on its own ERASE_MS-delayed timer distinct from
      // the character-erasing ticks above.
      await tick(ERASE_MS, 1);
    }

    // Full cycle complete — back at phrase 1, mid-reveal after one more tick.
    await tick(TYPE_MS, 1);
    expect(visibleText(heading)).toBe(LANDING_HEADLINE_PHRASES[0].slice(0, 1));
  });

  it("freezes on hover and resumes from the same character on leave", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });

    await tick(TYPE_MS, 5);
    const frozen = visibleText(heading);
    expect(frozen).toBe(LANDING_HEADLINE_PHRASES[0].slice(0, 5));

    fireEvent.mouseEnter(heading);
    await tick(TYPE_MS, 10);
    expect(visibleText(heading)).toBe(frozen);

    fireEvent.mouseLeave(heading);
    await tick(TYPE_MS, 1);
    expect(visibleText(heading)).toBe(LANDING_HEADLINE_PHRASES[0].slice(0, 6));
  });

  it("stays paused on focus even after the pointer leaves", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });

    await tick(TYPE_MS, 3);
    const frozen = visibleText(heading);

    fireEvent.mouseEnter(heading);
    fireEvent.focus(heading);
    fireEvent.mouseLeave(heading);

    await tick(TYPE_MS, 10);
    expect(visibleText(heading)).toBe(frozen);

    fireEvent.blur(heading);
    await tick(TYPE_MS, 1);
    expect(visibleText(heading)).not.toBe(frozen);
  });

  it("renders the first phrase whole with no caret and no rotation under reduced motion", async () => {
    mockMatchMedia(true);
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent(LANDING_HEADLINE_PHRASES[0]);
    expect(heading.querySelector(".typing-caret")).not.toBeInTheDocument();

    await tick(TYPE_MS, LANDING_HEADLINE_PHRASES[0].length);
    await tick(HOLD_MS, 1);
    await tick(5000, 1);
    expect(heading).toHaveTextContent(LANDING_HEADLINE_PHRASES[0]);
  });

  it("shows the caret at the empty boundary between phrases", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);
    const heading = screen.getByRole("heading", { level: 1 });
    const phrase = LANDING_HEADLINE_PHRASES[0];

    await tick(TYPE_MS, phrase.length);
    await tick(HOLD_MS, 1);
    await tick(ERASE_MS, phrase.length);
    expect(visibleText(heading)).toBe("");
    expect(heading.querySelector(".typing-caret")).toBeInTheDocument();
  });

  it("clears its pending timer on unmount without warnings", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);

    await tick(TYPE_MS, 3);
    unmount();

    await tick(10000, 1);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  describe("with a static prefix and suffix (the login screen's shape)", () => {
    const PREFIX = "better ";
    const SUFFIX = " your songs";

    function renderVerbHeadline() {
      render(
        <TypingHeadline phrases={LOGIN_HEADLINE_VERBS} prefix={PREFIX} suffix={SUFFIX} />
      );
      return screen.getByRole("heading", { level: 1 });
    }

    it("holds the prefix and suffix still while only the verb types in", async () => {
      const heading = renderVerbHeadline();

      // Before a single character of the verb exists, the sentence around
      // it is already fully rendered.
      expect(visibleText(heading)).toBe(`${PREFIX}${SUFFIX}`);

      await tick(TYPE_MS, 1);
      expect(visibleText(heading)).toBe(`${PREFIX}o${SUFFIX}`);

      await tick(TYPE_MS, LOGIN_HEADLINE_VERBS[0].length - 1);
      expect(visibleText(heading)).toBe(`${PREFIX}organize${SUFFIX}`);
    });

    it("erases only the verb, leaving the prefix and suffix intact", async () => {
      const heading = renderVerbHeadline();
      const verb = LOGIN_HEADLINE_VERBS[0];

      await tick(TYPE_MS, verb.length);
      await tick(HOLD_MS, 1);
      await tick(ERASE_MS, verb.length);

      expect(visibleText(heading)).toBe(`${PREFIX}${SUFFIX}`);
      expect(heading.querySelector(".typing-caret")).toBeInTheDocument();
    });

    it("cycles the verb through organize -> clean -> propagate and wraps", async () => {
      const heading = renderVerbHeadline();

      for (const verb of LOGIN_HEADLINE_VERBS) {
        await tick(TYPE_MS, verb.length);
        expect(visibleText(heading)).toBe(`${PREFIX}${verb}${SUFFIX}`);
        await tick(HOLD_MS, 1);
        await tick(ERASE_MS, verb.length);
        await tick(ERASE_MS, 1);
      }

      await tick(TYPE_MS, 1);
      expect(visibleText(heading)).toBe(`${PREFIX}o${SUFFIX}`);
    });

    it("builds the accessible name from prefix + verb + suffix, not the typed prefix", async () => {
      const heading = renderVerbHeadline();

      await tick(TYPE_MS, 3);

      // Visibly mid-word, but the heading still names the whole sentence.
      expect(visibleText(heading)).toBe(`${PREFIX}org${SUFFIX}`);
      expect(heading).toHaveAccessibleName("better organize your songs");
    });

    it("renders the whole sentence with the first verb under reduced motion", async () => {
      mockMatchMedia(true);
      const heading = renderVerbHeadline();

      expect(heading).toHaveAccessibleName("better organize your songs");
      expect(heading.querySelector(".typing-caret")).not.toBeInTheDocument();

      await tick(TYPE_MS, 20);
      await tick(HOLD_MS, 1);
      expect(visibleText(heading)).toBe(`${PREFIX}organize${SUFFIX}`);
    });
  });

  it("exposes the complete active phrase as the accessible name mid-reveal", async () => {
    render(<TypingHeadline phrases={LANDING_HEADLINE_PHRASES} />);

    await tick(TYPE_MS, 3);

    const heading = screen.getByRole("heading", { level: 1, name: LANDING_HEADLINE_PHRASES[0] });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAccessibleName(LANDING_HEADLINE_PHRASES[0]);
  });
});
