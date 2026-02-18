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

  useEffect(() => {
    const expiry = sessionStorage.getItem("token_expiry");
    const now = Math.floor(Date.now() / 1000);
    const isExpired = !expiry || parseInt(expiry) < now;
    if (isExpired && pathname !== "/login" && pathname !== "/callback") {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated 
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
      <body className="layout">
          {/* Navbar         */}
          <nav style={{ 
            padding: "1rem", 
            background: pathname === "/" 
            ? "linear-gradient(to right, rgb(88, 28, 135), rgb(30, 58, 138))" 
            : "white",
            color: "inherit" 
          }}>
            <ul style={{ display: "flex", gap: "1rem", listStyle: "none" }}>
              <li>
                <Link
                  href="/"
                  className={`font-bold text-[1.15rem] tracking-[0.03em] no-underline transition-colors duration-200 hover:underline hover:text-[#1DB954] ${pathname === "/" ? "text-white" : "text-black"}`}
                >
                  Home
                </Link>
              </li>
            </ul>
          </nav>
          {/* Main Page Content */}
          <main
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            
              {children}
          </main>
          <footer style={{ textAlign: "center", padding: "1rem", background: "#1DB954" }}>
            © 2025 i-wish-spotify-could
          </footer>
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}





