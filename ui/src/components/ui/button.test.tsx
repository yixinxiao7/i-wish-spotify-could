import React from "react";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "./button";
import { cn } from "@/lib/utils";

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

  it("keeps the brand variant's border — the sole boundary carrier in light mode — at every size", () => {
    // Regression guard for M9: `sm`/`lg` used to redeclare the base
    // radius, and tailwind-merge silently dropped the variant's own
    // rounded-full because it appeared later in the composed string. The
    // border here is a value, not shape, so the same class-merge risk
    // would show up as a missing "border-brand-green-border", not a
    // visual oddity — this asserts it survives at every size the app uses.
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      // Routed through cn() (tailwind-merge), matching what the Button
      // component actually renders — buttonVariants() alone returns the
      // raw, pre-merge string and would miss a conflict like this one.
      const classes = cn(buttonVariants({ variant: "brand", size }));
      expect(classes).toContain("border-brand-green-border");
      expect(classes).toContain("rounded-full");
    }
  });

  it("keeps the brand variant's shape consistent across sizes (M9)", () => {
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      const classes = cn(buttonVariants({ variant: "brandMuted", size }));
      expect(classes).toContain("rounded-full");
      expect(classes).not.toContain("rounded-md");
    }
  });

  it("uses a flat fill, no gradient, for both brand variants", () => {
    for (const variant of ["brand", "brandMuted", "brandDestructive"] as const) {
      const classes = buttonVariants({ variant });
      expect(classes).not.toMatch(/gradient/i);
    }
  });
});
