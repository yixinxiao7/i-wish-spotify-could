import React from "react";
import { cn } from "@/lib/utils";

interface SongCardSkeletonProps {
  /** Must match the className passed to the SongCard it stands in for, so the
   * placeholder and the loaded row occupy the same footprint. */
  className?: string;
}

export function SongCardSkeleton({ className = "" }: SongCardSkeletonProps) {
  return (
    <div
      className={cn("surface-row w-full animate-pulse rounded-xl p-4 sm:p-6", className)}
      aria-hidden="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-foreground/10 sm:h-16 sm:w-16" />
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-foreground/10 sm:w-40" />
            <div className="h-2.5 w-24 rounded bg-foreground/10 sm:w-28" />
          </div>
        </div>
        <div className="h-11 w-full rounded-full bg-foreground/10 sm:h-10 sm:w-[150px]" />
      </div>
    </div>
  );
}
