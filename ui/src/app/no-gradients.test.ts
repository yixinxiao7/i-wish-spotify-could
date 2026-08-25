import fs from "fs";
import path from "path";

// The user does not want the gradient back. A rendered-DOM check can't see
// arbitrary Tailwind values reliably under jsdom (no real stylesheet is
// compiled into the test environment), so this scans source directly for
// any CSS gradient function, in markup, class strings, or stylesheets.
// Catches a gradient reintroduced through an arbitrary-value utility, an
// inline style, or a background-image declaration, in either theme.

const SRC_DIR = path.join(__dirname, "..");
const SCAN_EXTENSIONS = [".ts", ".tsx", ".css"];
const GRADIENT_PATTERN = /(linear|radial|conic)-gradient\(/i;

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name)) && !entry.name.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

const files = collectFiles(SRC_DIR);

describe("no gradients anywhere in source", () => {
  it("scanned at least the expected surface area", () => {
    // A sanity floor so a refactor that moves this test's search root
    // can't silently make the scan scan zero files and pass vacuously.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)("%s contains no gradient function", (file) => {
    const content = fs.readFileSync(file, "utf8");
    expect(content).not.toMatch(GRADIENT_PATTERN);
  });
});
