"use client";

import React, { useEffect, useState }  from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      <html lang="en">
        <body className="layout">
          <p>Redirecting...</p>
        </body>
      </html>
    );
  }

  const shouldUseSharedBackground = mounted && isAuthenticated && pathname !== "/login";

  return (
    <html lang="en">
      <body className="layout">
          <div className="relative flex min-h-screen flex-col overflow-x-hidden">
          {shouldUseSharedBackground && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(145deg,#d5f7ff_0%,#8fdfff_26%,#6cb4ef_48%,#6fdc94_72%,#b8f487_100%)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.72),transparent_46%),radial-gradient(circle_at_78%_14%,rgba(176,248,255,0.58),transparent_42%),radial-gradient(circle_at_22%_82%,rgba(163,255,154,0.46),transparent_44%),radial-gradient(circle_at_84%_74%,rgba(255,243,146,0.42),transparent_38%),radial-gradient(circle_at_48%_54%,rgba(96,163,255,0.38),transparent_52%)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.16),rgba(255,255,255,0)_35%,rgba(26,132,223,0.12)_62%,rgba(121,208,95,0.2)_100%)] mix-blend-soft-light"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:repeating-linear-gradient(125deg,rgba(255,255,255,0.26)_0px,rgba(255,255,255,0.26)_1px,transparent_1px,transparent_14px)]"
              />
            </>
          )}
          {/* Navbar         */}
          {mounted && pathname !== "/login" && (
            <nav
              className="bg-transparent px-4 py-4"
              style={{ fontFamily: '"Avenir Next", "Trebuchet MS", "Gill Sans", sans-serif' }}
            >
              <ul className="m-0 flex list-none gap-4 p-0">
                <li>
                  <Link
                    href="/"
                    className="font-bold text-[1.1rem] tracking-[0.03em] text-[#134f55] no-underline transition-colors duration-200 hover:text-[#0f7f50] hover:underline"
                  >
                    Home
                  </Link>
                </li>
              </ul>
            </nav>
          )}
          {/* Main Page Content */}
          <main
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            
              {children}
          </main>
          <footer
            className="bg-[linear-gradient(180deg,rgba(184,244,135,0.22)_0%,rgba(85,210,134,0.72)_38%,#1DB954_100%)] py-4 text-center"
            style={{ fontFamily: '"Avenir Next", "Trebuchet MS", "Gill Sans", sans-serif' }}
          >
            © 2025 i-wish-spotify-could
          </footer>
          </div>
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
