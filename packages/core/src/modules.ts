export type FieldType = "string" | "number" | "date" | "boolean";

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  description: string;
}

/**
 * How an adapter authenticates. 'pkce' covers providers with a standards-
 * compliant PKCE flow usable from a pure web context (e.g. Spotify).
 * 'oauth_loopback' covers providers (e.g. Google) that are only secretless
 * via a "Desktop app" client + loopback redirect — Tauri only, not web.
 * 'device_flow' covers providers (e.g. GitHub) with no PKCE support at all,
 * where the secretless path is a user-facing device code instead.
 * 'oauth_client_secret' requires a confidential secret — needs the Phase 5
 * OAuth relay, unsupported in Local Purist mode regardless of adapter.
 */
export type AdapterAuthType =
  | "none"
  | "api_key"
  | "pkce"
  | "oauth_loopback"
  | "device_flow"
  | "oauth_client_secret";

export interface AdapterDefinition {
  id: string;
  name: string;
  version: string;
  authType: AdapterAuthType;
  fields: Field[];
  /** Seconds a cached payload from this adapter is considered fresh. Adapter-specific, not global — an append-only history (Spotify) tolerates a much longer TTL than a mutable calendar. */
  defaultTtlSeconds: number;
}

export interface DataPayload {
  fields: Field[];
  rows: Record<string, unknown>[];
  /** ISO timestamp. Underscore-prefixed to avoid colliding with a real field name an adapter happens to return (e.g. a "source" column). */
  _cachedAt: string;
  _source: string;
}

export type ModuleType = "single" | "merge";

export interface ModuleSource {
  adapterId: string;
  alias: string;
}

export type Transformation =
  | { kind: "filter"; expression: string }
  | { kind: "formula"; expression: string }
  | { kind: "sort"; field: string; direction: "asc" | "desc" }
  | { kind: "group"; field: string };

export type ModuleOutputType = "chart" | "table" | "kanban" | "list" | "calendar";

export interface ModuleOutput {
  type: ModuleOutputType;
  config: Record<string, unknown>;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  version: string;
  type: ModuleType;
  sources: ModuleSource[];
  /** Required when type is 'merge'; left unresolved until Phase 2 decides join semantics (inner/left, date-truncation granularity). */
  joinOn?: string;
  transformations: Transformation[];
  output: ModuleOutput;
}
