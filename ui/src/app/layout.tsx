"use client";

import React, { useEffect, useState }  from "react";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { DELETE_LOGOUT_ENDPOINT } from "@/utils/config";


const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
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
      <html lang="en">
        <body className="layout">
          <p>Redirecting...</p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${ibmPlexMono.variable} ${ibmPlexMono.className} layout`}>
          <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden">
          {/* Navbar         */}
          {mounted && pathname !== "/login" && (
            <nav
              className="relative z-10 bg-transparent px-4 py-4"
            >
              <ul className="m-0 flex list-none items-center gap-4 p-0">
                <li>
                  <Link
                    href="/"
                    className="bg-[linear-gradient(90deg,#3fd15a,#5bc6f5)] bg-clip-text font-bold text-[1.5rem] tracking-[0.03em] text-transparent no-underline transition-all duration-200 hover:brightness-110 hover:drop-shadow-[0_0_6px_rgba(91,198,245,0.5)]"
                    style={{ WebkitTextStroke: "1px #134f55" }}
                  >
                    home
                  </Link>
                </li>
                <li className="ml-auto">
                  <button
                    onClick={handleLogout}
                    className="rounded-full border border-[#9fd3e9] bg-[linear-gradient(90deg,rgba(248,251,253,0.9),rgba(226,241,250,0.9))] px-4 py-1.5 text-sm font-semibold text-[#1f5f69] shadow-[0_10px_30px_rgba(64,160,170,0.18)] transition hover:scale-[1.01] hover:brightness-105"
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
            className="relative z-10 bg-[#e7f1f4] py-4 text-center"
          >
            © 2025 i-wish-spotify-could
          </footer>
          </div>
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
