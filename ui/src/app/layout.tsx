"use client";

import React, { useEffect, useState }  from "react";
import Head from 'next/head';
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
  const [spotifyCode, setSpotifyCode] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname()

  useEffect(() => {
    const spotifyCode = localStorage.getItem("spotify_auth_code");
    if (spotifyCode) {
      setSpotifyCode(spotifyCode);
    } else if (pathname !== "/login" && pathname !== "/callback") {
      // Redirect to login page if no code is found
      router.push("/login");
    }
  }, []);

  if (spotifyCode === null && pathname !== "/login" && pathname !== "/callback") {
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
        {/* <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          > */}
          {/* Navbar         */}
          <nav style={{ padding: "1rem", background: "inherit", color: "inherit" }}>
            <ul style={{ display: "flex", gap: "1rem", listStyle: "none" }}>
              <li><Link href="/">Home</Link></li>
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





