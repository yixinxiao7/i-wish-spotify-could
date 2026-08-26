import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Propagate songs",
  description: "Pick a destination playlist, then a source playlist to draw songs from.",
};

export default function PropagateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
