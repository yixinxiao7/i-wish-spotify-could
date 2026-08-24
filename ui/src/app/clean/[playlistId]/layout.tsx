import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clean playlist",
  description: "Review a playlist's songs sorted by how stale they are, and remove the ones you don't listen to anymore.",
};

export default function CleanPlaylistLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
