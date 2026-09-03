import type { DataPayload, Entry, ModuleDefinition } from "@bulletspace/core";
import { useCallback, useEffect, useState } from "react";
import { adapterRegistry } from "../../adapters/registry";
import { runModule } from "../../lib/runModule";
import { ModuleOutputRenderer } from "../ModuleOutputRenderer";

interface CustomModuleCardProps {
  moduleDef: ModuleDefinition;
  entries: Entry[];
}

/**
 * The display half of a custom module -- same runModule + ModuleOutputRenderer
 * pattern SharedModuleCard.tsx already uses for imported modules, since a
 * custom module is exactly the same shape (a ModuleDefinition), just built
 * here instead of pasted in. No "(shared)" label, no Remove button -- the
 * canvas element's own context-menu Delete already covers that, and
 * removing this card wouldn't make sense while its build panel
 * (CustomModuleBuilderPanel) is still editing the same definition.
 */
export function CustomModuleCard({ moduleDef, entries }: CustomModuleCardProps) {
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
        <h3>{moduleDef.name || "Custom Module"}</h3>
        <div className="entry-actions">
          <button type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      {moduleDef.sources.length === 0 && <p className="empty">Select a data source in the properties panel.</p>}
      {missingAdapterIds.length > 0 && (
        <p className="empty">
          Needs data from: {missingAdapterIds.map((id) => adapterRegistry[id]?.name ?? id).join(", ")}. Connect that
          adapter elsewhere on the board first.
        </p>
      )}
      {payload && payload.rows.length === 0 && missingAdapterIds.length === 0 && <p className="empty">No data yet.</p>}
      {payload && payload.rows.length > 0 && <ModuleOutputRenderer output={moduleDef.output} payload={payload} />}
    </div>
  );
}
