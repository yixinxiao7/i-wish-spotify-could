import React from "react";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders a native button by default", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("supports asChild rendering", () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>
    );
    expect(screen.getByRole("link", { name: "Go" })).toBeInTheDocument();
  });

  it("returns variant classes", () => {
    const classes = buttonVariants({ variant: "destructive", size: "sm" });
    expect(classes).toContain("bg-destructive");
    expect(classes).toContain("h-8");
  });
});
