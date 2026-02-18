import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";

describe("Select", () => {
  it("opens and selects an item", () => {
    const onValueChange = jest.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="limit-select">
          <SelectValue placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Limit</SelectLabel>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );

    fireEvent.click(screen.getByRole("combobox", { name: "limit-select" }));
    fireEvent.click(screen.getByText("25"));

    expect(onValueChange).toHaveBeenCalledWith("25");
  });
});
