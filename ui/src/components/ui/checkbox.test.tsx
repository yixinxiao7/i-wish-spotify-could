import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("calls onCheckedChange when clicked", () => {
    const onCheckedChange = jest.fn();
    render(<Checkbox aria-label="playlist box" onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "playlist box" }));

    expect(onCheckedChange).toHaveBeenCalled();
  });
});
