import React from "react";
import { render } from "@testing-library/react";
import { SongCardSkeleton } from "./song-card-skeleton";

describe("SongCardSkeleton", () => {
  it("carries the caller's width classes instead of defaulting to a fixed width", () => {
    const { container } = render(<SongCardSkeleton className="w-full md:w-3/5 lg:w-2/5" />);
    const root = container.firstElementChild as HTMLElement;
    // The real SongCard is rendered by its callers with this exact className
    // (see organize/page.tsx and clean/[playlistId]/page.tsx) so the
    // skeleton must carry the same width classes, not stretch to max-w-5xl.
    expect(root.className).toContain("w-full");
    expect(root.className).toContain("md:w-3/5");
    expect(root.className).toContain("lg:w-2/5");
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<SongCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
