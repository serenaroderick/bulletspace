import type { CanvasConfig, Entry, Journal } from "@bulletspace/core";

export interface JournalExport {
  version: 1;
  journal: Journal;
  entries: Entry[];
}

export function serializeJournalExport(journal: Journal, entries: Entry[]): JournalExport {
  return { version: 1, journal, entries };
}

function isValidCanvasConfig(value: unknown): value is CanvasConfig {
  if (typeof value !== "object" || value === null) return false;
  const config = value as Record<string, unknown>;
  const grid = config.grid as Record<string, unknown> | undefined;
  return (
    typeof config.width === "number" &&
    typeof config.height === "number" &&
    typeof config.zoom === "number" &&
    typeof config.scrollX === "number" &&
    typeof config.scrollY === "number" &&
    typeof grid === "object" &&
    grid !== null &&
    typeof grid.style === "string" &&
    typeof grid.spacing === "number" &&
    typeof grid.color === "string" &&
    typeof grid.opacity === "number" &&
    typeof config.canvasBackground === "object" &&
    config.canvasBackground !== null &&
    typeof config.parallax === "object" &&
    config.parallax !== null &&
    typeof config.snapToGrid === "boolean"
  );
}

function isValidEntry(value: unknown): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.journalId === "string" &&
    typeof entry.title === "string" &&
    typeof entry.content === "string" &&
    isValidCanvasConfig(entry.canvasConfig) &&
    (entry.mood === null || typeof entry.mood === "number") &&
    (entry.energy === null || typeof entry.energy === "number") &&
    (entry.focus === null || typeof entry.focus === "number") &&
    Array.isArray(entry.tags) &&
    typeof entry.createdAt === "number" &&
    typeof entry.updatedAt === "number"
  );
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

  const candidate = parsed as JournalExport;
  const invalidIndex = candidate.entries.findIndex((entry) => !isValidEntry(entry));
  if (invalidIndex !== -1) {
    throw new Error(`Entry at index ${invalidIndex} is missing required fields or has the wrong shape.`);
  }

  return candidate;
}
