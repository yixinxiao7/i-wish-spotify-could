import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clean up playlists",
  description: "Pick one of your playlists to find and remove songs you no longer listen to.",
};

export default function CleanLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
