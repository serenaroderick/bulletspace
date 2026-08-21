import { describe, expect, it } from "vitest";
import { extractWikilinks, findBacklinks, toMarkdownLinks } from "./wikilinks";

describe("extractWikilinks", () => {
  it("extracts a plain wikilink", () => {
    expect(extractWikilinks("See [[Mood Log]] for details.")).toEqual([
      { target: "Mood Log", alias: null },
    ]);
  });

  it("extracts a wikilink with an alias", () => {
    expect(extractWikilinks("See [[Mood Log|my moods]] for details.")).toEqual([
      { target: "Mood Log", alias: "my moods" },
    ]);
  });

  it("extracts multiple wikilinks", () => {
    expect(extractWikilinks("[[A]] and [[B|second]]")).toEqual([
      { target: "A", alias: null },
      { target: "B", alias: "second" },
    ]);
  });

  it("returns an empty array when there are no wikilinks", () => {
    expect(extractWikilinks("Just plain markdown, no links here.")).toEqual([]);
  });
});

describe("toMarkdownLinks", () => {
  it("rewrites a plain wikilink into a standard markdown link", () => {
    expect(toMarkdownLinks("See [[Mood Log]].")).toBe(
      "See [Mood Log](bulletspace://entry/Mood%20Log).",
    );
  });

  it("uses the alias as the link label when present", () => {
    expect(toMarkdownLinks("See [[Mood Log|my moods]].")).toBe(
      "See [my moods](bulletspace://entry/Mood%20Log).",
    );
  });

  it("leaves ordinary markdown links untouched", () => {
    const content = "See [Google](https://google.com).";
    expect(toMarkdownLinks(content)).toBe(content);
  });
});

describe("findBacklinks", () => {
  const entries = [
    { id: "1", title: "Mood Log", content: "How I feel today." },
    { id: "2", title: "Daily Note", content: "Linked to [[Mood Log]] today." },
    { id: "3", title: "Other Note", content: "No links here." },
    { id: "4", title: "Aliased Note", content: "See [[mood log|my moods]]." },
  ];

  it("finds entries linking to the target, case-insensitively", () => {
    const backlinks = findBacklinks(entries, "Mood Log");
    expect(backlinks.map((e) => e.id).sort()).toEqual(["2", "4"]);
  });

  it("returns an empty array when nothing links to the target", () => {
    expect(findBacklinks(entries, "Other Note")).toEqual([]);
  });
});
