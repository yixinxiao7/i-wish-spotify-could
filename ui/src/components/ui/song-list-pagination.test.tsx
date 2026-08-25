import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SongListPagination } from "./song-list-pagination";

describe("SongListPagination", () => {
  it("renders exactly one Previous and one Next control", () => {
    render(<SongListPagination total={490} limit={10} currentPage={3} onNavigate={jest.fn()} />);
    expect(screen.getAllByLabelText("Go to previous page")).toHaveLength(1);
    expect(screen.getAllByLabelText("Go to next page")).toHaveLength(1);
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(<SongListPagination total={0} limit={10} currentPage={1} onNavigate={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("always includes a compact position readout, independent of viewport", () => {
    render(<SongListPagination total={490} limit={10} currentPage={3} onNavigate={jest.fn()} />);
    expect(screen.getByText("Page 3 of 49")).toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last page", () => {
    const { rerender } = render(<SongListPagination total={30} limit={10} currentPage={1} onNavigate={jest.fn()} />);
    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute("aria-disabled", "false");

    rerender(<SongListPagination total={30} limit={10} currentPage={3} onNavigate={jest.fn()} />);
    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not navigate past the boundary when Previous or Next is clicked while disabled", () => {
    const onNavigate = jest.fn();
    render(<SongListPagination total={30} limit={10} currentPage={1} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByLabelText("Go to previous page"));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("calls onNavigate with the offset for the clicked page", () => {
    const onNavigate = jest.fn();
    render(<SongListPagination total={490} limit={10} currentPage={3} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("4"));
    expect(onNavigate).toHaveBeenCalledWith(30, 4);
  });

  it("never renders a skipped-pages marker between two consecutive page numbers", () => {
    render(<SongListPagination total={490} limit={10} currentPage={3} onNavigate={jest.fn()} />);
    // Page 3 of 49: 1,2,3,4 render consecutively with no leading ellipsis.
    const nav = screen.getByRole("navigation");
    const items = Array.from(nav.querySelectorAll("li")).map((li) => li.textContent);
    const firstEllipsisIdx = items.findIndex((t) => t === "More pages");
    const oneIdx = items.indexOf("1");
    const twoIdx = items.indexOf("2");
    expect(oneIdx).toBeGreaterThan(-1);
    expect(twoIdx).toBe(oneIdx + 1);
    // The only ellipsis present (if any) comes after the window, not between 1 and 2.
    if (firstEllipsisIdx > -1) {
      expect(firstEllipsisIdx).toBeGreaterThan(twoIdx);
    }
  });
});
