"use client";

import React, { useEffect, useState }  from "react";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { DELETE_LOGOUT_ENDPOINT } from "@/utils/config";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "next-themes";


const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-11 w-11" />;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="btn-brand-muted flex h-11 w-11 items-center justify-center"
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
    </button>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleLogout = async () => {
    await fetch(DELETE_LOGOUT_ENDPOINT, { method: "DELETE" });
    sessionStorage.removeItem("token_expiry");
    router.push("/login");
  };

  useEffect(() => {
    const expiry = sessionStorage.getItem("token_expiry");
    const now = Math.floor(Date.now() / 1000);
    const isExpired = !expiry || parseInt(expiry) < now;
    if (isExpired && pathname !== "/login" && pathname !== "/callback") {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
    setMounted(true);
  }, []);

  if (mounted && !isAuthenticated
    && pathname !== "/login" && pathname !== "/callback") {
    return(
      <html lang="en" suppressHydrationWarning>
        <body className="layout">
          <p>Redirecting...</p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ibmPlexMono.variable} ${ibmPlexMono.className} layout`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="relative flex min-h-screen flex-col overflow-x-hidden">
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
                    className="rounded-md bg-[linear-gradient(90deg,hsl(var(--brand-green)),hsl(var(--brand-blue)))] bg-clip-text font-bold text-[1.5rem] tracking-[0.03em] text-transparent no-underline transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    home
                  </Link>
                </li>
                <li className="ml-auto flex items-center gap-3">
                  <ThemeToggle />
                  <button
                    onClick={handleLogout}
                    className="btn-brand-muted h-11 px-4 text-sm font-semibold"
                  >
                    log out
                  </button>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
