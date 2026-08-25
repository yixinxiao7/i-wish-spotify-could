"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";

interface TimerEntry {
  timeoutId: ReturnType<typeof setTimeout> | null;
  resumedAt: number;
  remainingMs: number;
}

interface UseDeferredRowActionOptions<T extends { id: string }> {
  /** How long a triggered action stays reversible, in ms. */
  windowMs: number;
  /**
   * Performs the actual side effect once the window elapses (or is flushed
   * early on unmount/pagehide). Throws on failure — the row is rolled back
   * out of pendingIds and onError is called, except during the best-effort
   * unmount/pagehide flush, where failures are swallowed (there is nowhere
   * left to report them to). `opts.keepalive`, when true, is set only
   * during that flush — pass it through to `fetch` so the request survives
   * page teardown.
   */
  perform: (row: T, opts?: { keepalive?: boolean }) => Promise<void>;
  /** Success-toast message for a row, e.g. `Removed "${row.name}"`. */
  buildToastMessage: (row: T) => string;
  /** Called after a failed perform has already rolled the row back out of pendingIds. */
  onError: (row: T, error: unknown) => void;
}

interface UseDeferredRowActionResult<T> {
  pendingIds: Set<string>;
  trigger: (row: T) => void;
  undo: (rowId: string) => void;
}

/**
 * Defers a row-level action (remove, add, ...) behind an undoable window:
 * the row is hidden immediately, a toast with a depleting progress bar
 * offers Undo, and the action only actually runs once the window elapses.
 * The window pauses while the user hovers or focuses within the toast (a
 * WCAG 2.2.1 requirement), and a still-pending action is flushed rather
 * than dropped on unmount or `pagehide`.
 *
 * `perform` must be referentially stable (wrap it in useCallback) — it is
 * an effect dependency that re-attaches the unmount/pagehide flush, and an
 * unstable reference would flush pending rows on every render.
 */
export function useDeferredRowAction<T extends { id: string }>({
  windowMs,
  perform,
  buildToastMessage,
  onError,
}: UseDeferredRowActionOptions<T>): UseDeferredRowActionResult<T> {
  const { showToast } = useToast();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // timeoutId is null while paused (hover/focus on the row's toast — see
  // trigger's onPauseChange) so this map, not a plain id->timeout map, is
  // what lets the deferred request and the toast's own dismiss clock stay
  // in lockstep without ever disagreeing about how much time is left.
  const timersRef = useRef<Map<string, TimerEntry>>(new Map());
  const rowsRef = useRef<Map<string, T>>(new Map());
  const toastIdsRef = useRef<Map<string, number>>(new Map());

  const flush = useCallback(
    async (row: T) => {
      timersRef.current.delete(row.id);
      toastIdsRef.current.delete(row.id);
      rowsRef.current.delete(row.id);
      try {
        await perform(row);
        // Success: leave the id in pendingIds permanently — the row's
        // effect really did happen, and the next fetch of this data won't
        // include it anyway.
      } catch (error) {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
        onError(row, error);
      }
    },
    [perform, onError]
  );

  // Flush any pending action rather than silently dropping it: a hard
  // close/reload fires `pagehide` (keepalive carries the request past
  // unload), and leaving the route fires this effect's own cleanup on
  // unmount.
  useEffect(() => {
    const flushAllPending = () => {
      timersRef.current.forEach(({ timeoutId }, id) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        const row = rowsRef.current.get(id);
        if (row) {
          perform(row, { keepalive: true }).catch(() => {
            // Best-effort: the page is going away, there is nowhere left
            // to report a failure to.
          });
        }
      });
      timersRef.current.clear();
      rowsRef.current.clear();
      toastIdsRef.current.clear();
    };

    window.addEventListener("pagehide", flushAllPending);
    return () => {
      window.removeEventListener("pagehide", flushAllPending);
      flushAllPending();
    };
  }, [perform]);

  const undo = useCallback((rowId: string) => {
    const entry = timersRef.current.get(rowId);
    if (entry?.timeoutId !== null && entry?.timeoutId !== undefined) {
      clearTimeout(entry.timeoutId);
    }
    timersRef.current.delete(rowId);
    toastIdsRef.current.delete(rowId);
    rowsRef.current.delete(rowId);
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, []);

  // Pauses this row's own timer in lockstep with its toast's auto-dismiss
  // clock, so hover or focus on the toast can never let the action fire
  // out from under a user who is mid-reach for Undo.
  const pause = useCallback((rowId: string) => {
    const entry = timersRef.current.get(rowId);
    if (!entry || entry.timeoutId === null) return; // already paused, or gone
    clearTimeout(entry.timeoutId);
    const elapsed = Date.now() - entry.resumedAt;
    timersRef.current.set(rowId, {
      timeoutId: null,
      resumedAt: entry.resumedAt,
      remainingMs: Math.max(0, entry.remainingMs - elapsed),
    });
  }, []);

  const resume = useCallback(
    (rowId: string) => {
      const entry = timersRef.current.get(rowId);
      if (!entry || entry.timeoutId !== null) return; // not paused, or already gone
      const row = rowsRef.current.get(rowId);
      if (!row) return;
      if (entry.remainingMs <= 0) {
        flush(row);
        return;
      }
      const timeoutId = setTimeout(() => flush(row), entry.remainingMs);
      timersRef.current.set(rowId, { timeoutId, resumedAt: Date.now(), remainingMs: entry.remainingMs });
    },
    [flush]
  );

  const trigger = useCallback(
    (row: T) => {
      setPendingIds((prev) => new Set(prev).add(row.id));
      rowsRef.current.set(row.id, row);

      const timeoutId = setTimeout(() => flush(row), windowMs);
      timersRef.current.set(row.id, { timeoutId, resumedAt: Date.now(), remainingMs: windowMs });

      const toastId = showToast(buildToastMessage(row), "success", {
        durationMs: windowMs,
        progress: true,
        action: { label: "Undo", onClick: () => undo(row.id) },
        onPauseChange: (paused) => {
          if (paused) pause(row.id);
          else resume(row.id);
        },
      });
      toastIdsRef.current.set(row.id, toastId);
    },
    [flush, windowMs, buildToastMessage, showToast, undo, pause, resume]
  );

  return { pendingIds, trigger, undo };
}
