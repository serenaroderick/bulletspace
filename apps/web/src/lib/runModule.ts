import { type DataPayload, type Entry, type ModuleDefinition, runQueryPipeline } from "@bulletspace/core";
import { entriesToDataPayload, journalAdapterDefinition } from "../adapters/journal";
import { getCachedPayload } from "./adapterCache";

export interface RunModuleResult {
  payload: DataPayload | null;
  missingAdapterIds: string[];
}

/**
 * Executes any ModuleDefinition against whatever data is actually
 * available locally right now -- the "journal" pseudo-adapter always
 * resolves from live entries; every other adapter resolves from its
 * cached payload (set by whichever module last fetched it -- this runner
 * never triggers a fetch itself). Missing sources are reported rather
 * than silently producing an empty result, since "you need to connect X
 * first" is a far more useful message than a blank chart.
 */
export async function runModule(moduleDef: ModuleDefinition, entries: Entry[]): Promise<RunModuleResult> {
  const sourceData: Array<{ alias: string; payload: DataPayload }> = [];
  const missingAdapterIds: string[] = [];

  for (const source of moduleDef.sources) {
    if (source.adapterId === journalAdapterDefinition.id) {
      sourceData.push({ alias: source.alias, payload: entriesToDataPayload(entries) });
      continue;
    }

    const cached = await getCachedPayload(source.adapterId);
    if (!cached) {
      missingAdapterIds.push(source.adapterId);
      continue;
    }
    sourceData.push({ alias: source.alias, payload: cached });
  }

  if (missingAdapterIds.length > 0) {
    return { payload: null, missingAdapterIds };
  }

  return { payload: runQueryPipeline(moduleDef, sourceData), missingAdapterIds: [] };
}
