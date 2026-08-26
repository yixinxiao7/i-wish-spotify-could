"use client";

import React, { useEffect, useRef, useState } from "react";

export const LANDING_HEADLINE_PHRASES = [
  "put your liked songs where they belong",
  "clear out the songs you've stopped playing",
  "grow one playlist from another",
] as const;

/**
 * The login screen animates only the verb of a fixed sentence
 * ("better ___ your songs"), so its phrase set is single words rather
 * than whole clauses. Same one-per-tool contract as the landing set.
 */
export const LOGIN_HEADLINE_VERBS = ["organize", "clean", "propagate"] as const;

const TYPE_MS = 55;
const ERASE_MS = 30;
const HOLD_MS = 1800;

type Phase = "typing" | "holding" | "erasing";

interface TypingHeadlineProps {
  phrases: readonly string[];
  className?: string;
  /**
   * Static text rendered before the animated phrase (e.g. "better "). It
   * never animates, and it is part of the heading's accessible name — so
   * a surface can animate a single word inside a fixed sentence rather
   * than replacing the whole line.
   */
  prefix?: string;
  /** Static text rendered after the animated phrase (e.g. " your songs"). */
  suffix?: string;
}

export const TypingHeadline: React.FC<TypingHeadlineProps> = ({
  phrases,
  className,
  prefix = "",
  suffix = "",
}) => {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // matchMedia doesn't exist during SSR, so this is resolved on mount
    // rather than in the initializer — the un-animated null state is also
    // the correct first-paint output for reduced-motion users, so there's
    // no flash of animation while this resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const paused = isHovered || hasFocusWithin;

  useEffect(() => {
    if (reducedMotion !== false) return;
    if (paused) return;

    const activePhrase = phrases[phraseIndex];
    let delay: number;
    let step: () => void;

    if (phase === "typing") {
      if (charCount < activePhrase.length) {
        delay = TYPE_MS;
        step = () => setCharCount((c) => c + 1);
      } else {
        delay = 0;
        step = () => setPhase("holding");
      }
    } else if (phase === "holding") {
      delay = HOLD_MS;
      step = () => setPhase("erasing");
    } else {
      if (charCount > 0) {
        delay = ERASE_MS;
        step = () => setCharCount((c) => c - 1);
      } else {
        delay = ERASE_MS;
        step = () => {
          setPhraseIndex((i) => (i + 1) % phrases.length);
          setPhase("typing");
        };
      }
    }

    timeoutRef.current = setTimeout(step, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reducedMotion, paused, phase, charCount, phraseIndex, phrases]);

  const activePhrase = phrases[phraseIndex];

  if (reducedMotion !== false) {
    return (
      <h1
        aria-label={`${prefix}${phrases[0]}${suffix}`}
        className={className}
      >
        <span aria-hidden="true">{`${prefix}${phrases[0]}${suffix}`}</span>
      </h1>
    );
  }

  const visibleText = activePhrase.slice(0, charCount);

  return (
    <h1
      aria-label={`${prefix}${activePhrase}${suffix}`}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // hasFocusWithin has no focusable descendant today, but WCAG 2.2.2
      // requires a non-pointer way to stop auto-updating content — keeping
      // this wired means the headline already honors keyboard focus the
      // moment anything inside it becomes focusable, with no future work.
      onFocus={() => setHasFocusWithin(true)}
      onBlur={() => setHasFocusWithin(false)}
    >
      <span aria-hidden="true">
        {prefix}
        {visibleText}
        <span className="typing-caret" />
        {suffix}
      </span>
    </h1>
  );
};
