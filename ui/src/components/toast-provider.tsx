"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  /** Overrides the default 5s auto-dismiss. */
  durationMs?: number;
  /** An extra button (e.g. "Undo") shown before the dismiss control. */
  action?: ToastAction;
  /** Shows a bar depleting from full to empty over `durationMs`. */
  progress?: boolean;
  /** Called whenever this toast's own auto-dismiss timer pauses or resumes
   * (hover or keyboard focus anywhere within the toast). Lets a caller keep
   * a second clock — e.g. a deferred DELETE — in lockstep with the toast
   * that represents it, so the two can never disagree about how much time
   * is left. */
  onPauseChange?: (paused: boolean) => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
  /** Mirrors remainingMsRef for rendering (the progress bar) — reactive
   * state is read during render, the ref is read from event handlers. */
  remainingMs: number;
  action?: ToastAction;
  progress: boolean;
  paused: boolean;
}

interface ToastContextValue {
  /** Returns the new toast's id, so a caller can dismiss it early (e.g. on undo). */
  showToast: (message: string, type: ToastType, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TOAST_DISMISS_MS = 5000;
// How often the progress bar's width is recomputed. Deliberately a plain
// interval rather than a CSS keyframe animation so reduced-motion can drop
// just the interpolating transition (see the motion-reduce class below)
// while remaining time is still conveyed via these discrete updates.
const PROGRESS_TICK_MS = 100;

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastProgressBar({ durationMs, remainingMs, paused }: { durationMs: number; remainingMs: number; paused: boolean }) {
  const [ratio, setRatio] = useState(() => Math.max(0, remainingMs / durationMs));

  useEffect(() => {
    if (paused) {
      // Freeze exactly where it was — no ticking while paused.
      setRatio(Math.max(0, remainingMs / durationMs));
      return;
    }
    const start = Date.now();
    const startingRemaining = remainingMs;
    const tick = () => {
      const elapsed = Date.now() - start;
      setRatio(Math.max(0, (startingRemaining - elapsed) / durationMs));
    };
    tick();
    const interval = setInterval(tick, PROGRESS_TICK_MS);
    return () => clearInterval(interval);
    // remainingMs intentionally excluded: it only changes at the moment
    // paused flips, which is already a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, paused]);

  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-foreground/15" aria-hidden="true">
      {/* transform, not width: width is a layout property and forces
          layout/paint on every 100ms tick; scaleX is compositor-only. */}
      <div
        className="h-full w-full origin-left rounded-full bg-current transition-transform duration-100 ease-linear motion-reduce:transition-none"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}

interface ToastRowProps {
  toast: ToastItem;
  remainingMs: number;
  dismiss: (id: number) => void;
  pauseToast: (id: number) => void;
  resumeToast: (id: number) => void;
}

function ToastRow({ toast, remainingMs, dismiss, pauseToast, resumeToast }: ToastRowProps) {
  // Paused while EITHER hovered or focus is within — resuming requires
  // both to clear, so tabbing from Undo to Dismiss (a blur immediately
  // followed by a focus) never lets the window resume mid-transition.
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const wasActiveRef = useRef(false);

  const syncActive = () => {
    const active = hoveredRef.current || focusedRef.current;
    if (active === wasActiveRef.current) return;
    wasActiveRef.current = active;
    if (active) {
      pauseToast(toast.id);
    } else {
      resumeToast(toast.id);
    }
  };

  return (
    <div
      onMouseEnter={() => {
        hoveredRef.current = true;
        syncActive();
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        syncActive();
      }}
      onFocus={() => {
        focusedRef.current = true;
        syncActive();
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        focusedRef.current = false;
        syncActive();
      }}
      // aria-atomic on the toast itself, not the region: a region-level
      // aria-atomic re-reads every toast already in the region whenever a
      // new one is added. Scoped here, only this toast's own content is
      // read as a unit.
      aria-atomic="true"
      className={`pointer-events-auto flex w-full flex-col rounded-2xl px-5 py-3 shadow-md sm:w-auto sm:max-w-sm ${
        toast.type === "success" ? "toast-success" : "toast-error"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium">{toast.message}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              dismiss(toast.id);
            }}
            className="flex-shrink-0 rounded-full px-2 py-1.5 text-xs font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={() => dismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded-full p-2 hover:bg-foreground/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      {toast.progress && (
        <ToastProgressBar durationMs={toast.durationMs} remainingMs={remainingMs} paused={toast.paused} />
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  // Imperative bookkeeping, kept outside React state so pause/resume never
  // has to read stale state from inside a setState updater. `toasts` state
  // exists purely to drive rendering (paused flag, progress bar).
  const timers = useRef<Map<number, { timeoutId: ReturnType<typeof setTimeout>; resumedAt: number }>>(new Map());
  const remainingMsRef = useRef<Map<number, number>>(new Map());
  const pauseCallbacks = useRef<Map<number, (paused: boolean) => void>>(new Map());

  const clearTimer = useCallback((id: number) => {
    const timerInfo = timers.current.get(id);
    if (timerInfo) {
      clearTimeout(timerInfo.timeoutId);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      clearTimer(id);
      remainingMsRef.current.delete(id);
      pauseCallbacks.current.delete(id);
    },
    [clearTimer]
  );

  const startTimer = useCallback(
    (id: number, ms: number) => {
      const timeoutId = setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { timeoutId, resumedAt: Date.now() });
    },
    [dismiss]
  );

  const pauseToast = useCallback((id: number) => {
    const timerInfo = timers.current.get(id);
    if (!timerInfo) return; // already paused, or gone
    clearTimeout(timerInfo.timeoutId);
    timers.current.delete(id);
    const elapsed = Date.now() - timerInfo.resumedAt;
    const prevRemaining = remainingMsRef.current.get(id) ?? 0;
    const nextRemaining = Math.max(0, prevRemaining - elapsed);
    remainingMsRef.current.set(id, nextRemaining);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: true, remainingMs: nextRemaining } : t)));
    pauseCallbacks.current.get(id)?.(true);
  }, []);

  const resumeToast = useCallback(
    (id: number) => {
      if (timers.current.has(id)) return; // already running
      const remaining = remainingMsRef.current.get(id);
      if (remaining === undefined) return; // toast already gone
      if (remaining <= 0) {
        dismiss(id);
        return;
      }
      startTimer(id, remaining);
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: false } : t)));
      pauseCallbacks.current.get(id)?.(false);
    },
    [dismiss, startTimer]
  );

  const showToast = useCallback(
    (message: string, type: ToastType, options?: ToastOptions) => {
      const id = ++nextId.current;
      const durationMs = options?.durationMs ?? DEFAULT_TOAST_DISMISS_MS;
      remainingMsRef.current.set(id, durationMs);
      if (options?.onPauseChange) {
        pauseCallbacks.current.set(id, options.onPauseChange);
      }
      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          type,
          durationMs,
          remainingMs: durationMs,
          action: options?.action,
          progress: options?.progress ?? false,
          paused: false,
        },
      ]);
      startTimer(id, durationMs);
      return id;
    },
    [startTimer]
  );

  const successToasts = toasts.filter((t) => t.type === "success");
  const errorToasts = toasts.filter((t) => t.type === "error");

  const renderToast = (toast: ToastItem) => (
    <ToastRow
      key={toast.id}
      toast={toast}
      remainingMs={toast.remainingMs}
      dismiss={dismiss}
      pauseToast={pauseToast}
      resumeToast={resumeToast}
    />
  );

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-5 right-5 z-50 flex flex-col items-end gap-2 sm:left-auto">
        {/* Two separate regions, both always mounted and starting empty so
            assistive tech is already watching before any toast lands in
            them — a region that appears already populated is often not
            announced. Errors get an assertive region so a failure
            interrupts rather than queuing behind routine status (M10). */}
        <div role="status" aria-live="polite" aria-label="Notifications" className="flex w-full flex-col items-end gap-2">
          {successToasts.map(renderToast)}
        </div>
        <div role="alert" aria-live="assertive" aria-label="Notifications" className="flex w-full flex-col items-end gap-2">
          {errorToasts.map(renderToast)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
