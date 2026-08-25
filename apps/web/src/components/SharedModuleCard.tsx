import { type DataPayload, type Entry, type ModuleDefinition } from "@bulletspace/core";
import { useCallback, useEffect, useState } from "react";
import { adapterRegistry } from "../adapters/registry";
import { runModule } from "../lib/runModule";
import { ModuleOutputRenderer } from "./ModuleOutputRenderer";

interface SharedModuleCardProps {
  moduleDef: ModuleDefinition;
  entries: Entry[];
  onRemove: () => void;
}

export function SharedModuleCard({ moduleDef, entries, onRemove }: SharedModuleCardProps) {
  const [payload, setPayload] = useState<DataPayload | null>(null);
  const [missingAdapterIds, setMissingAdapterIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const result = await runModule(moduleDef, entries);
    setPayload(result.payload);
    setMissingAdapterIds(result.missingAdapterIds);
  }, [moduleDef, entries]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="module">
      <div className="module-header">
        <h3>{moduleDef.name} (shared)</h3>
        <div className="entry-actions">
          <button type="button" onClick={load}>
            Refresh
          </button>
          <button type="button" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
      {missingAdapterIds.length > 0 && (
        <p className="empty">
          Needs data from:{" "}
          {missingAdapterIds
            .map((id) => adapterRegistry[id]?.name ?? id)
            .join(", ")}
          . Connect that adapter elsewhere on the dashboard first.
        </p>
      )}
      {payload && payload.rows.length === 0 && missingAdapterIds.length === 0 && (
        <p className="empty">No data yet.</p>
      )}
      {payload && payload.rows.length > 0 && (
        <ModuleOutputRenderer output={moduleDef.output} payload={payload} />
      )}
    </div>
  );
}
