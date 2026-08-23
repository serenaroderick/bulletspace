import type { DatabaseAdapter, Journal } from "@bulletspace/core";

function newId(): string {
  return crypto.randomUUID();
}

let defaultJournalPromise: Promise<Journal> | null = null;

/**
 * Finds or creates the app's single default journal. Memoized so React 18
 * StrictMode's dev-mode double-invoke (or any other concurrent caller)
 * can't race two "no journal exists yet" checks into creating duplicates --
 * confirmed live on the desktop build, where the raw JSON store made two
 * "My Journal" entries with identical timestamps directly visible.
 */
export function ensureDefaultJournal(adapter: DatabaseAdapter): Promise<Journal> {
  if (!defaultJournalPromise) {
    defaultJournalPromise = (async () => {
      const journals = await adapter.listJournals();
      if (journals[0]) return journals[0];

      const now = Date.now();
      const created: Journal = {
        id: newId(),
        title: "My Journal",
        icon: null,
        createdAt: now,
        updatedAt: now,
      };
      await adapter.createJournal(created);
      return created;
    })();
  }
  return defaultJournalPromise;
}

/** Test-only: clears the memoized promise between test cases. */
export function resetDefaultJournalCache(): void {
  defaultJournalPromise = null;
}
