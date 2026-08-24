"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { DELETE_LOGOUT_ENDPOINT } from "@/utils/config";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/toast-provider";

// True only once this component has hydrated on the client. Reading this
// via useSyncExternalStore (a no-op subscription, a constant client
// snapshot) rather than a `useState(false)` + `useEffect` pair avoids
// setting state from inside an effect purely to react to mounting.
const subscribeNoop = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) return <div className="h-11 w-11" />;

  return (
    <Button
      variant="brandMuted"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="flex h-11 w-11 items-center justify-center p-0"
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </Button>
  );
}

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const mounted = useHasMounted();

  const handleLogout = async () => {
    await fetch(DELETE_LOGOUT_ENDPOINT, { method: "DELETE" });
    sessionStorage.removeItem("token_expiry");
    router.push("/login");
  };

  // Genuinely effect-appropriate, not the "derived state" case this lint
  // rule usually targets: sessionStorage only exists client-side, and an
  // expired session needs a real navigation side effect, not just a
  // render-time value.
  useEffect(() => {
    const expiry = sessionStorage.getItem("token_expiry");
    const now = Math.floor(Date.now() / 1000);
    const isExpired = !expiry || parseInt(expiry) < now;
    if (isExpired && pathname !== "/login" && pathname !== "/callback") {
      router.push("/login");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mounted && !isAuthenticated
    && pathname !== "/login" && pathname !== "/callback") {
    // Reuses the auth flow's own themed shell and spinner (see
    // callback/ClientComponent.tsx) rather than an unstyled fragment, so
    // an expired session doesn't flash bare, default-styled text (M12).
    return (
      <section className="auth-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
        <div
          role="status"
          className="surface-panel flex h-20 w-20 items-center justify-center rounded-full"
        >
          <svg
            className="h-9 w-9 animate-spin text-brand-muted motion-reduce:hidden"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="sr-only">Redirecting to login…</span>
        </div>
      </section>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ToastProvider>
      <div className="relative flex min-h-screen flex-col">
        {/* Navbar */}
        {mounted && pathname !== "/login" && (
          <nav
            aria-label="Main navigation"
            className="relative z-10 bg-transparent px-4 py-4"
          >
            <ul className="m-0 flex list-none items-center gap-4 p-0">
              <li>
                <Link
                  href="/"
                  className="rounded-md font-bold text-[1.5rem] tracking-[0.03em] text-brand-heading no-underline transition-colors duration-200 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  home
                </Link>
              </li>
              <li className="ml-auto flex items-center gap-3">
                <ThemeToggle />
                <Button
                  variant="brandMuted"
                  onClick={handleLogout}
                  className="h-11 px-4 text-sm font-semibold"
                >
                  log out
                </Button>
              </li>
            </ul>
          </nav>
        )}
        {/* Main Page Content */}
        <main
          className="relative z-10 antialiased"
        >
          {children}
        </main>
        <footer
          className="relative z-10 bg-brand-footer py-4 text-center"
        >
          © 2025 i-wish-spotify-could
        </footer>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
