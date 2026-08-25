import type { AdapterDefinition } from "@bulletspace/core";
import { githubAdapterDefinition } from "./github";
import { googleCalendarAdapterDefinition } from "./googleCalendar";
import { journalAdapterDefinition } from "./journal";
import { weatherAdapterDefinition } from "./weather";

/**
 * Every adapter this build knows about, keyed by id. This is what a
 * shared module's `requiredAdapters` manifest gets checked against on
 * import -- "installed" here just means "the code exists in this build,"
 * not that the user has connected/authenticated it yet. GitHub is listed
 * even though it's only wired into the desktop dashboard (web's CORS
 * block) since the adapter code itself exists in this build either way.
 */
export const adapterRegistry: Record<string, AdapterDefinition> = {
  [journalAdapterDefinition.id]: journalAdapterDefinition,
  [weatherAdapterDefinition.id]: weatherAdapterDefinition,
  [githubAdapterDefinition.id]: githubAdapterDefinition,
  [googleCalendarAdapterDefinition.id]: googleCalendarAdapterDefinition,
};

export function listKnownAdapters(): AdapterDefinition[] {
  return Object.values(adapterRegistry);
}

export function isAdapterKnown(adapterId: string): boolean {
  return adapterId in adapterRegistry;
}
