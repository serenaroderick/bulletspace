import { describe, expect, it } from "vitest";
import { clampRating, parseTags } from "./rating";

describe("clampRating", () => {
  it("returns null for empty input", () => {
    expect(clampRating("")).toBeNull();
    expect(clampRating("   ")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(clampRating("abc")).toBeNull();
  });

  it("clamps values above 10 down to 10", () => {
    expect(clampRating("500")).toBe(10);
  });

  it("clamps values below 1 up to 1", () => {
    expect(clampRating("-8")).toBe(1);
  });

  it("rounds fractional values", () => {
    expect(clampRating("7.6")).toBe(8);
  });

  it("passes through valid in-range integers unchanged", () => {
    expect(clampRating("5")).toBe(5);
  });
});

describe("parseTags", () => {
  it("splits comma-separated tags and trims whitespace", () => {
    expect(parseTags(" work, exercise ,family")).toEqual(["work", "exercise", "family"]);
  });

  it("drops empty entries from trailing/double commas", () => {
    expect(parseTags("work,,family,")).toEqual(["work", "family"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
  });
});
