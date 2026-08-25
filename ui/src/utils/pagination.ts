export type PageToken = { type: "page"; page: number } | { type: "ellipsis"; key: "leading" | "trailing" };

/**
 * Builds the numbered-page sequence for the desktop pagination control.
 * Always includes page 1 and lastPage; shows a window of up to one page on
 * either side of currentPage; inserts an ellipsis only where a real gap
 * exists between the shown pages, never between two consecutive numbers.
 */
export function buildPageList(currentPage: number, lastPage: number): PageToken[] {
  if (lastPage <= 1) return lastPage === 1 ? [{ type: "page", page: 1 }] : [];

  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(lastPage - 1, currentPage + 1);

  const tokens: PageToken[] = [{ type: "page", page: 1 }];

  if (windowStart > 2) {
    tokens.push({ type: "ellipsis", key: "leading" });
  }

  for (let page = windowStart; page <= windowEnd; page++) {
    tokens.push({ type: "page", page });
  }

  if (windowEnd < lastPage - 1) {
    tokens.push({ type: "ellipsis", key: "trailing" });
  }

  tokens.push({ type: "page", page: lastPage });

  return tokens;
}

export interface OffsetPage {
  offset: number;
  page: number;
}

/**
 * Clamps a requested offset/page pair to the valid range for the given
 * total and limit. Shared by every paged list so bounds behave identically
 * everywhere rather than drifting per page.
 */
export function clampOffsetPage(requestedOffset: number, requestedPage: number, total: number, limit: number): OffsetPage {
  const lastPage = Math.max(1, Math.ceil(total / limit));

  let offset = requestedOffset;
  if (offset < 0) {
    offset = 0;
  } else if (offset > total) {
    offset -= limit;
  }

  let page = requestedPage;
  if (page < 1) {
    page = 1;
  } else if (page > lastPage) {
    page = lastPage;
  }

  return { offset, page };
}

/**
 * A page-size change always returns the user to the first page at offset 0
 * — the only coherent position when the boundaries of every other page
 * just moved. Previously only the cleanup page did this; the organize page
 * kept the old offset and page number, drifting further with every
 * subsequent navigation.
 */
export function resetForLimitChange(): OffsetPage {
  return { offset: 0, page: 1 };
}
