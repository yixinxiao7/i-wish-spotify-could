"use client";

import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { buildPageList } from "@/utils/pagination";

interface SongListPaginationProps {
  total: number;
  limit: number;
  currentPage: number;
  /** Navigates to the given offset/page. Callers are expected to clamp via
   * clampOffsetPage before calling their own load logic. */
  onNavigate: (offset: number, page: number) => void;
}

/**
 * Shared pagination control for both paged song lists. There is exactly one
 * Previous and one Next control at all times; only the content between them
 * switches with viewport width. Below `sm` the numbered strip (which can
 * run to 428px — wider than a 320px viewport) is replaced by a position
 * readout, so the control always fits without forcing the page to scroll
 * horizontally.
 */
export function SongListPagination({ total, limit, currentPage, onNavigate }: SongListPaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / limit));

  if (total <= 0) return null;

  const goToPage = (page: number) => {
    onNavigate((page - 1) * limit, page);
  };

  const tokens = buildPageList(currentPage, lastPage);

  return (
    <Pagination className="px-6 py-2">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={currentPage <= 1}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : undefined}
            onClick={() => currentPage > 1 && goToPage(currentPage - 1)}
          />
        </PaginationItem>

        {/* Below sm: a position readout instead of the numbered strip. */}
        <PaginationItem className="sm:hidden">
          <span className="flex h-11 min-w-[44px] items-center justify-center px-2 text-sm text-brand-muted" aria-live="polite">
            Page {currentPage} of {lastPage}
          </span>
        </PaginationItem>

        {/* sm and above: the full numbered strip. */}
        {tokens.map((token) =>
          token.type === "ellipsis" ? (
            <PaginationItem key={token.key} className="hidden sm:block">
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={`page-${token.page}`} className="hidden sm:block">
              <PaginationLink isActive={token.page === currentPage} onClick={() => goToPage(token.page)}>
                {token.page}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            aria-disabled={currentPage >= lastPage}
            className={currentPage >= lastPage ? "pointer-events-none opacity-50" : undefined}
            onClick={() => currentPage < lastPage && goToPage(currentPage + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
