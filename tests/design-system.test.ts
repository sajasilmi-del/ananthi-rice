import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("design system", () => {
  const tokens = readFileSync("src/styles/tokens.css", "utf8").toLowerCase();
  const foundation = readFileSync("src/styles/foundation.css", "utf8");

  it("keeps sampled logo, wheat, pack, and sub-brand colors", () => {
    for (const color of ["#600030", "#300018", "#f0f0d8", "#e0a000", "#f0c020", "#c07000", "#004818", "#f06000", "#003090"]) {
      expect(tokens).toContain(color);
    }
  });

  it("defines type, space, radius, shadow, and breakpoints", () => {
    for (const token of ["--font-ui", "--font-heading", "--space-4", "--radius-md", "--shadow-card", "--bp-xs", "--bp-sm", "--bp-lg", "--bp-xl", "--bp-2xl"]) {
      expect(tokens).toContain(token);
    }
  });

  it("styles the reusable controls from one foundation", () => {
    for (const name of [".btn-primary", ".btn-whatsapp", ".product-card", ".badge-arthy", ".badge-santosh", ".badge-mahi", ".lang-switch", ".cart-button", ".section-heading", ".field"]) {
      expect(foundation).toContain(name);
    }
    expect(foundation).toContain("max-width: 1023px");
    expect(foundation).toContain("prefers-reduced-motion");
  });
});
