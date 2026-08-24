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
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
  action?: ToastAction;
  progress: boolean;
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

function ToastProgressBar({ durationMs }: { durationMs: number }) {
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setRatio(Math.max(0, 1 - elapsed / durationMs));
    };
    tick();
    const interval = setInterval(tick, PROGRESS_TICK_MS);
    return () => clearInterval(interval);
  }, [durationMs]);

  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-foreground/15" aria-hidden="true">
      <div
        className="h-full rounded-full bg-current transition-[width] duration-100 ease-linear motion-reduce:transition-none"
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType, options?: ToastOptions) => {
      const id = ++nextId.current;
      const durationMs = options?.durationMs ?? DEFAULT_TOAST_DISMISS_MS;
      setToasts((prev) => [
        ...prev,
        { id, message, type, durationMs, action: options?.action, progress: options?.progress ?? false },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs)
      );
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      {/* Always mounted, starting empty, so assistive tech is already
          watching this region before any toast lands in it — a region that
          appears already populated is often not announced. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-5 left-5 right-5 z-50 flex flex-col items-end gap-2 sm:left-auto"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
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
            {toast.progress && <ToastProgressBar durationMs={toast.durationMs} />}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
