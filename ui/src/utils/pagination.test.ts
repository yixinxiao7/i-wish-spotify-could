import { buildPageList, clampOffsetPage, resetForLimitChange } from './pagination';

describe("buildPageList", () => {
  it("shows no ellipsis between consecutive pages near the start", () => {
    // Page 3 of 49: 1,2,3,4 are all consecutive — no gap, no ellipsis before them.
    const tokens = buildPageList(3, 49);
    expect(tokens[0]).toEqual({ type: "page", page: 1 });
    expect(tokens[1]).toEqual({ type: "page", page: 2 });
    expect(tokens.some((t) => t.type === "ellipsis" && t.key === "leading")).toBe(false);
  });

  it("shows a leading ellipsis once a real gap opens up", () => {
    const tokens = buildPageList(6, 49);
    const leadingIdx = tokens.findIndex((t) => t.type === "ellipsis" && t.key === "leading");
    expect(leadingIdx).toBeGreaterThan(-1);
    expect(tokens[leadingIdx - 1]).toEqual({ type: "page", page: 1 });
    expect(tokens[leadingIdx + 1]).toEqual({ type: "page", page: 5 });
  });

  it("shows a trailing ellipsis when pages remain after the window", () => {
    const tokens = buildPageList(3, 49);
    const trailingIdx = tokens.findIndex((t) => t.type === "ellipsis" && t.key === "trailing");
    expect(trailingIdx).toBeGreaterThan(-1);
    expect(tokens[tokens.length - 1]).toEqual({ type: "page", page: 49 });
  });

  it("omits the trailing ellipsis near the end", () => {
    const tokens = buildPageList(48, 49);
    expect(tokens.some((t) => t.type === "ellipsis" && t.key === "trailing")).toBe(false);
    expect(tokens[tokens.length - 1]).toEqual({ type: "page", page: 49 });
  });

  it("omits both ellipses on a short list", () => {
    const tokens = buildPageList(2, 3);
    expect(tokens.some((t) => t.type === "ellipsis")).toBe(false);
    expect(tokens.map((t) => (t.type === "page" ? t.page : "…"))).toEqual([1, 2, 3]);
  });

  it("returns a single page for a one-page list", () => {
    expect(buildPageList(1, 1)).toEqual([{ type: "page", page: 1 }]);
  });
});

describe("clampOffsetPage", () => {
  it("clamps a negative offset to zero and page below 1 to 1", () => {
    expect(clampOffsetPage(-10, 0, 100, 10)).toEqual({ offset: 0, page: 1 });
  });

  it("clamps an offset past the total back by one page", () => {
    expect(clampOffsetPage(150, 16, 100, 10)).toEqual({ offset: 140, page: 10 });
  });

  it("clamps a page past the last page to the last page", () => {
    expect(clampOffsetPage(50, 99, 45, 10)).toEqual({ offset: 40, page: 5 });
  });

  it("passes through a valid offset/page unchanged", () => {
    expect(clampOffsetPage(20, 3, 100, 10)).toEqual({ offset: 20, page: 3 });
  });
});

describe("resetForLimitChange", () => {
  it("always returns to offset 0, page 1", () => {
    expect(resetForLimitChange()).toEqual({ offset: 0, page: 1 });
  });
});
