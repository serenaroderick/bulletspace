import type { Entry } from "@bulletspace/core";
import { BarChart } from "../charts/BarChart";

const DEFAULT_LIMIT = 10;

interface TagFrequencyModuleProps {
  entries: Entry[];
  /** Configurable via the module's properties panel -- see ModulePropertiesPanel.tsx. */
  limit?: number;
}

export function TagFrequencyModule({ entries, limit = DEFAULT_LIMIT }: TagFrequencyModuleProps) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const rows = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return (
    <div className="module">
      <h3>Tag Frequency</h3>
      {rows.length === 0 ? (
        <p className="empty">No tags used yet — add some in the entry form (comma-separated).</p>
      ) : (
        <BarChart rows={rows} xField="tag" yField="count" />
      )}
    </div>
  );
}
