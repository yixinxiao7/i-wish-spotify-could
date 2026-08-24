import fs from "fs";
import path from "path";

// Verifies the actual token values in globals.css against the WCAG floors
// from the ui-design-system spec: 4.5:1 for text, 3:1 for a control's
// boundary against its surrounding surface. Reads the real stylesheet
// rather than hardcoding hex values, so a later palette tweak that still
// clears the floor keeps passing, and one that quietly regresses it fails
// here instead of shipping (see design.md D8).

const CSS_PATH = path.join(__dirname, "globals.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

function extractBlock(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Selector not found in globals.css: ${selector}`);
  const openBrace = css.indexOf("{", start);
  let depth = 0;
  let i = openBrace;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return css.slice(openBrace + 1, i);
}

function parseTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--([\w-]+):\s*([^;]+);/g;
  let match;
  while ((match = re.exec(block))) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const lightTokens = parseTokens(extractBlock(":root"));
const darkTokens = parseTokens(extractBlock(".dark"));

// Only HSL triplet tokens ("H S% L%") are handled — the handful of rgba()
// tokens (toast backgrounds) aren't part of the contrast-floor surface set.
function hslTripletToRgb(value: string): [number, number, number] {
  const m = value.match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`Not a bare "H S% L%" token: "${value}"`);
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(hslTripletToRgb(a));
  const l2 = relativeLuminance(hslTripletToRgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const TEXT_FLOOR = 4.5;
const BOUNDARY_FLOOR = 3;

describe.each([
  ["light", lightTokens],
  ["dark", darkTokens],
])("%s theme contrast floors", (_themeName, tokens) => {
  const pageBg = tokens["brand-page-bg"];
  const card = tokens["card"];

  it("has a page background and a card token defined", () => {
    expect(pageBg).toBeTruthy();
    expect(card).toBeTruthy();
  });

  it.each([
    ["muted-foreground", "on the card"],
  ])("%s clears %s text contrast (>= 4.5:1)", (token) => {
    expect(contrastRatio(tokens[token], card)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("muted-foreground clears text contrast against the page background (>= 4.5:1)", () => {
    expect(contrastRatio(tokens["muted-foreground"], pageBg)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("brand-heading clears text contrast against the card (>= 4.5:1)", () => {
    expect(contrastRatio(tokens["brand-heading"], card)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("brand-body clears text contrast against the card (>= 4.5:1)", () => {
    expect(contrastRatio(tokens["brand-body"], card)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("border/input clears the boundary floor against the card (>= 3:1)", () => {
    expect(contrastRatio(tokens["border"], card)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
    expect(contrastRatio(tokens["input"], card)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
  });

  it("border/input clears the boundary floor against the page background (>= 3:1)", () => {
    expect(contrastRatio(tokens["border"], pageBg)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
    expect(contrastRatio(tokens["input"], pageBg)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
  });

  it("brand-accent-border (secondary button boundary) clears 3:1 against the card and the page background", () => {
    expect(contrastRatio(tokens["brand-accent-border"], card)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
    expect(contrastRatio(tokens["brand-accent-border"], pageBg)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
  });

  it("brand-green-border (primary button boundary) clears 3:1 against the card", () => {
    expect(contrastRatio(tokens["brand-green-border"], card)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
  });

  it("brand-on-accent text clears 4.5:1 against the brand-green fill", () => {
    expect(contrastRatio(tokens["brand-on-accent"], tokens["brand-green"])).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("brand-destructive clears 3:1 as a boundary against the card", () => {
    expect(contrastRatio(tokens["brand-destructive"], card)).toBeGreaterThanOrEqual(BOUNDARY_FLOOR);
  });

  it("the card is distinguishable from the page background (not identical)", () => {
    expect(contrastRatio(card, pageBg)).toBeGreaterThan(1);
  });
});

describe("cross-theme structure", () => {
  const requiredTokens = [
    "background",
    "foreground",
    "card",
    "muted-foreground",
    "border",
    "input",
    "brand-heading",
    "brand-body",
    "brand-green",
    "brand-green-border",
    "brand-on-accent",
    "brand-accent-border",
    "brand-destructive",
    "brand-footer",
    "brand-page-bg",
  ];

  it.each(requiredTokens)("%s is defined in both the light and dark theme blocks", (token) => {
    expect(lightTokens[token]).toBeTruthy();
    expect(darkTokens[token]).toBeTruthy();
  });
});
