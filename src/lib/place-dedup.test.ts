import { describe, expect, it } from "vitest";
import {
  normalizePlaceName,
  parseContributors,
  mergeContributor,
} from "./place-dedup";

describe("normalizePlaceName", () => {
  it("lowercases", () => {
    expect(normalizePlaceName("Publix")).toBe("publix");
  });

  it("collapses runs of whitespace", () => {
    expect(normalizePlaceName("  Magic   Kingdom  ")).toBe("magic kingdom");
  });

  it("strips punctuation", () => {
    expect(normalizePlaceName("Publix · Sand Lake")).toBe("publix sand lake");
    expect(normalizePlaceName("Publix - Sand Lake")).toBe("publix sand lake");
    expect(normalizePlaceName("Hash House A Go Go!")).toBe("hash house a go go");
  });

  it("treats visually-equivalent names as equal", () => {
    expect(normalizePlaceName("Disney World")).toBe(
      normalizePlaceName("disney  world"),
    );
    expect(normalizePlaceName("Publix · Sand Lake")).toBe(
      normalizePlaceName("publix sand lake"),
    );
  });

  it("keeps non-Latin scripts intact", () => {
    expect(normalizePlaceName("東京ドーム")).toBe("東京ドーム");
    expect(normalizePlaceName("Café · München")).toBe("café münchen");
  });
});

describe("parseContributors", () => {
  it("returns [] for null/empty", () => {
    expect(parseContributors(null)).toEqual([]);
    expect(parseContributors("")).toEqual([]);
    expect(parseContributors(undefined)).toEqual([]);
  });

  it("splits on comma and trims", () => {
    expect(parseContributors("Alice, Bob,Carol")).toEqual(["Alice", "Bob", "Carol"]);
    expect(parseContributors("  Alice  ,  Bob  ")).toEqual(["Alice", "Bob"]);
  });

  it("drops empty fragments", () => {
    expect(parseContributors("Alice,,Bob")).toEqual(["Alice", "Bob"]);
    expect(parseContributors(",")).toEqual([]);
  });
});

describe("mergeContributor", () => {
  it("appends a new contributor", () => {
    expect(mergeContributor("Alice", "Bob")).toBe("Alice, Bob");
    expect(mergeContributor(null, "Alice")).toBe("Alice");
    expect(mergeContributor("", "Alice")).toBe("Alice");
  });

  it("preserves existing order", () => {
    expect(mergeContributor("Alice, Bob", "Carol")).toBe("Alice, Bob, Carol");
  });

  it("is case-insensitive and skips duplicates", () => {
    expect(mergeContributor("Alice, Bob", "alice")).toBe(null);
    expect(mergeContributor("Alice, Bob", "BOB")).toBe(null);
    expect(mergeContributor("Alice, Bob", "Bob")).toBe(null);
  });

  it("returns null for empty name (no-op)", () => {
    expect(mergeContributor("Alice", "")).toBe(null);
    expect(mergeContributor("Alice", "   ")).toBe(null);
  });

  it("trims surrounding whitespace on the new name", () => {
    expect(mergeContributor("Alice", "  Bob  ")).toBe("Alice, Bob");
  });
});
