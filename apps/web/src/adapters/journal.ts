import type { AdapterDefinition, DataPayload, Entry } from "@bulletspace/core";

/**
 * A pseudo-adapter wrapping the journal's own local entries as a
 * query-engine data source, so mood/energy/focus can be merged against
 * real external adapters (weather, etc.) through the same pipeline.
 * authType 'none' and defaultTtlSeconds 0 reflect that this never goes
 * over the network and is always as fresh as the local DB.
 */
export const journalAdapterDefinition: AdapterDefinition = {
  id: "journal",
  name: "Journal Entries",
  version: "1.0.0",
  authType: "none",
  defaultTtlSeconds: 0,
  fields: [
    { id: "date", name: "Date", type: "date", description: "" },
    { id: "rating", name: "Mood Rating", type: "number", description: "" },
    { id: "energy", name: "Energy", type: "number", description: "" },
    { id: "focus", name: "Focus", type: "number", description: "" },
  ],
};

export function entriesToDataPayload(entries: Entry[]): DataPayload {
  const rows = entries
    .filter((entry) => entry.mood !== null || entry.energy !== null || entry.focus !== null)
    .map((entry) => ({
      date: new Date(entry.createdAt).toISOString(),
      rating: entry.mood,
      energy: entry.energy,
      focus: entry.focus,
    }));

  return {
    fields: journalAdapterDefinition.fields,
    rows,
    _cachedAt: new Date().toISOString(),
    _source: journalAdapterDefinition.id,
  };
}
