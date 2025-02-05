import React from "react";
import Link from "next/link";
import { ThemeProvider } from "./theme-provider";
import { useEffect, useState } from "react";
import Login from '../pages/index'

export default function Layout({ children }: { children: React.ReactNode }) {
  const [spotifyCode, setSpotifyCode] = useState<string | null>(null);

  useEffect(() => {
    // Only runs on the client side
    const spotifyCode = localStorage.getItem("spotify_auth_code");
    setSpotifyCode(spotifyCode);
  }, []);

  const renderHeaderAndBody = () => {
    if (spotifyCode !== null) {
      return(
        <>
          {/* Navbar */}
          <nav style={{ padding: "1rem", background: "inherit", color: "inherit" }}>
            <ul style={{ display: "flex", gap: "1rem", listStyle: "none" }}>
              <li><Link href="/landing">Home</Link></li>
            </ul>
          </nav>

          {/* Main Page Content */}
          <main className="main-content">
            <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
            >
                {children}
            </ThemeProvider>
          </main>
        </>
      )
    } else {
      return <Login />
    }
  }

  return (
    <div className="layout">
      {renderHeaderAndBody()}
      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "1rem", background: "#1DB954" }}>
        © 2025 i-wish-spotify-could
      </footer>
    </div>
  );
}
