import type { AdapterDefinition, ModuleDefinition } from "./modules.js";

/**
 * What actually gets shared, copy-paste or via a gist link, per the
 * Phase 4 "cheap test" scope. Only the Module (declarative JSON) travels
 * as real content -- Adapters are executable code, a higher trust tier,
 * so only their identifying metadata comes along, as a manifest telling
 * the importer what they need to already have installed. No adapter code
 * is ever transmitted this way.
 */
export interface ModuleShareFile {
  version: 1;
  module: ModuleDefinition;
  requiredAdapters: Array<{ id: string; name: string; version: string }>;
}

export function serializeModuleShare(
  moduleDef: ModuleDefinition,
  knownAdapters: AdapterDefinition[],
): ModuleShareFile {
  const requiredAdapters = moduleDef.sources
    .map((source) => knownAdapters.find((adapter) => adapter.id === source.adapterId))
    .filter((adapter): adapter is AdapterDefinition => adapter !== undefined)
    .map((adapter) => ({ id: adapter.id, name: adapter.name, version: adapter.version }));

  return { version: 1, module: moduleDef, requiredAdapters };
}

function isValidModuleDefinition(value: unknown): value is ModuleDefinition {
  if (typeof value !== "object" || value === null) return false;
  const module = value as Record<string, unknown>;
  return (
    typeof module.id === "string" &&
    typeof module.name === "string" &&
    typeof module.version === "string" &&
    (module.type === "single" || module.type === "merge") &&
    Array.isArray(module.sources) &&
    Array.isArray(module.transformations) &&
    typeof module.output === "object" &&
    module.output !== null
  );
}

export function parseModuleShare(raw: string): ModuleShareFile {
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
    !isValidModuleDefinition((parsed as { module?: unknown }).module) ||
    !Array.isArray((parsed as { requiredAdapters?: unknown }).requiredAdapters)
  ) {
    throw new Error("Not a valid BulletSpace module share file.");
  }

  return parsed as ModuleShareFile;
}

export interface AdapterAvailability {
  id: string;
  name: string;
  available: boolean;
}

/** Checks a share file's declared adapter requirements against what's actually installed. */
export function checkRequiredAdapters(
  share: ModuleShareFile,
  installedAdapterIds: string[],
): AdapterAvailability[] {
  return share.requiredAdapters.map((required) => ({
    id: required.id,
    name: required.name,
    available: installedAdapterIds.includes(required.id),
  }));
}
