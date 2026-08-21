import type { Entry, Journal } from "@bulletspace/core";

export interface JournalExport {
  version: 1;
  journal: Journal;
  entries: Entry[];
}

export function serializeJournalExport(journal: Journal, entries: Entry[]): JournalExport {
  return { version: 1, journal, entries };
}

export function parseJournalExport(raw: string): JournalExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Not valid JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { journal?: unknown }).journal !== "object" ||
    !Array.isArray((parsed as { entries?: unknown }).entries)
  ) {
    throw new Error("Not a valid BulletSpace export file.");
  }

  return parsed as JournalExport;
}
