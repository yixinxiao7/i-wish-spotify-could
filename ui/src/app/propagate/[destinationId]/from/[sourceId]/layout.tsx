import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Propagate playlist",
  description: "Add songs from one playlist into another, reversibly.",
};

export default function PropagateSongsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
