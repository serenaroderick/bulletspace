import { InMemoryAdapter } from "@bulletspace/core";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultJournal, resetDefaultJournalCache } from "./journal";

describe("ensureDefaultJournal", () => {
  afterEach(() => {
    resetDefaultJournalCache();
  });

  it("creates a journal when none exists", async () => {
    const adapter = new InMemoryAdapter();
    const journal = await ensureDefaultJournal(adapter);
    expect(journal.title).toBe("My Journal");
    expect(await adapter.listJournals()).toHaveLength(1);
  });

  it("returns the existing journal instead of creating a second one", async () => {
    const adapter = new InMemoryAdapter();
    const existing = { id: "j1", title: "Existing", icon: null, createdAt: 1, updatedAt: 1 };
    await adapter.createJournal(existing);

    const journal = await ensureDefaultJournal(adapter);
    expect(journal).toEqual(existing);
    expect(await adapter.listJournals()).toHaveLength(1);
  });

  it("never creates duplicates under concurrent calls (the StrictMode double-invoke race)", async () => {
    const adapter = new InMemoryAdapter();

    const [first, second] = await Promise.all([
      ensureDefaultJournal(adapter),
      ensureDefaultJournal(adapter),
    ]);

    expect(first).toEqual(second);
    expect(await adapter.listJournals()).toHaveLength(1);
  });
});
