import { describe, expect, it } from "vitest";
import { shortTitle, shortCity, shortDisplayName, titleCase } from "./title";

describe("titleCase", () => {
  it("capitalizes first letter of each word", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });
  it("preserves short ALL-CAPS acronyms", () => {
    expect(titleCase("BBQ grill")).toBe("BBQ Grill");
    expect(titleCase("3BR home")).toBe("3BR Home");
  });
  it("normalizes long screaming words", () => {
    expect(titleCase("DREAM VILLA")).toBe("Dream Villa");
  });
});

describe("shortTitle", () => {
  it("returns empty for null", () => {
    expect(shortTitle(null)).toBe("");
  });

  it("takes the first chunk before a pipe", () => {
    expect(
      shortTitle("Dream VILLA | POOL/SPA| GAME Room|10 Min to Disney"),
    ).toBe("Dream Villa");
  });

  it("strips asterisk decorations", () => {
    expect(
      shortTitle("*Lakefront Pool Home *paddleboard*kayak*game room*"),
    ).toBe("Lakefront Pool Home");
  });

  it("drops trailing parenthetical codes", () => {
    expect(shortTitle("Solterra Resort (7869 OL)")).toBe("Solterra Resort");
  });

  it("truncates very long titles at a word boundary", () => {
    const out = shortTitle(
      "A Really Really Really Really Really Long Property Name Forever",
    );
    expect(out.length).toBeLessThanOrEqual(34); // 32 + "…"
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s+…$/);
  });

  it("handles plain titles unchanged", () => {
    expect(shortTitle("Family Resort Home with Private Pool")).toMatch(
      /Family Resort/,
    );
  });
});

describe("shortCity", () => {
  it("takes the locality before the comma", () => {
    expect(shortCity("Kissimmee, Florida, US")).toBe("Kissimmee");
    expect(shortCity("Kissimmee")).toBe("Kissimmee");
  });
  it("returns empty for null", () => {
    expect(shortCity(null)).toBe("");
  });
});

describe("shortDisplayName", () => {
  it("joins shortened title and city with em dash", () => {
    expect(
      shortDisplayName(
        "Dream VILLA | POOL/SPA| GAME Room|10 Min to Disney",
        "Kissimmee, Florida",
      ),
    ).toBe("Dream Villa — Kissimmee");
  });

  it("returns just the title if no location", () => {
    expect(shortDisplayName("Family Resort Home", null)).toBe(
      "Family Resort Home",
    );
  });

  it("returns just the city if no title", () => {
    expect(shortDisplayName(null, "Kissimmee, FL")).toBe("Kissimmee");
  });

  it("falls back to 'Untitled' when both empty", () => {
    expect(shortDisplayName(null, null)).toBe("Untitled");
  });
});
