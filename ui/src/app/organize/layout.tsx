import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organize",
  description:
    "Browse your uncategorized liked songs and sort them into playlists.",
};

export default function OrganizeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
