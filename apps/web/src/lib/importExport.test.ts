import { describe, expect, it } from "vitest";
import { parseJournalExport, serializeJournalExport } from "./importExport";

const journal = { id: "j1", title: "My Journal", icon: null, createdAt: 1, updatedAt: 1 };
const entries = [
  {
    id: "e1",
    journalId: "j1",
    title: "Entry",
    content: "hello",
    mood: 5,
    energy: null,
    focus: null,
    tags: [],
    createdAt: 1,
    updatedAt: 1,
  },
];

describe("serializeJournalExport / parseJournalExport", () => {
  it("round-trips a journal and its entries", () => {
    const exported = serializeJournalExport(journal, entries);
    const raw = JSON.stringify(exported);
    const parsed = parseJournalExport(raw);
    expect(parsed).toEqual(exported);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseJournalExport("not json")).toThrow("Not valid JSON.");
  });

  it("rejects JSON missing the expected shape", () => {
    expect(() => parseJournalExport(JSON.stringify({ foo: "bar" }))).toThrow(
      "Not a valid BulletSpace export file.",
    );
  });

  it("rejects an unsupported version", () => {
    const badVersion = { ...serializeJournalExport(journal, entries), version: 2 };
    expect(() => parseJournalExport(JSON.stringify(badVersion))).toThrow(
      "Not a valid BulletSpace export file.",
    );
  });

  it("rejects an entry missing required fields", () => {
    const malformed = {
      version: 1,
      journal,
      entries: [{ id: "e1", title: "Missing everything else" }],
    };
    expect(() => parseJournalExport(JSON.stringify(malformed))).toThrow(
      "Entry at index 0 is missing required fields or has the wrong shape.",
    );
  });
});
