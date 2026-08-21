import type { DataPayload, ModuleDefinition, Transformation } from "./modules.js";

export interface NamedDataPayload {
  alias: string;
  payload: DataPayload;
}

export type JoinType = "inner" | "left";
export type JoinGranularity = "exact" | "day" | "week" | "month";

export interface MergeOptions {
  joinOn: string;
  joinType?: JoinType;
  granularity?: JoinGranularity;
}

function truncateToGranularity(value: unknown, granularity: JoinGranularity): string {
  if (granularity === "exact") return String(value);
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  if (granularity === "day") return date.toISOString().slice(0, 10);
  if (granularity === "week") {
    const dayOfWeek = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((dayOfWeek + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 7);
}

/**
 * Merges multiple aliased DataPayloads on a shared join key -- the join
 * semantics deliberately left unresolved in the Phase 0 schema, resolved
 * here. Fields other than the join key are namespaced as `${alias}.${field}`
 * in the output row.
 *
 * Simplification: if multiple rows within one source share a join key,
 * only the first is used. This is not a full relational join engine --
 * it's built for the "one reading per day per source" shape adapters
 * actually produce (mood entries, daily weather), not arbitrary many-to-many
 * joins.
 */
export function mergeDataPayloads(sources: NamedDataPayload[], options: MergeOptions): DataPayload {
  const { joinOn, joinType = "inner", granularity = "day" } = options;
  if (sources.length === 0) {
    return { fields: [], rows: [], _cachedAt: new Date().toISOString(), _source: "merge" };
  }

  const indexed = sources.map(({ alias, payload }) => {
    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of payload.rows) {
      const key = truncateToGranularity(row[joinOn], granularity);
      if (!byKey.has(key)) byKey.set(key, row);
    }
    return { alias, payload, byKey };
  });

  const baseKeys =
    joinType === "left"
      ? [...indexed[0].byKey.keys()]
      : indexed.reduce<string[]>((keys, source, i) => {
          if (i === 0) return [...source.byKey.keys()];
          return keys.filter((key) => source.byKey.has(key));
        }, []);

  const rows = baseKeys.map((key) => {
    const row: Record<string, unknown> = { [joinOn]: key };
    for (const source of indexed) {
      const sourceRow = source.byKey.get(key);
      for (const [field, value] of Object.entries(sourceRow ?? {})) {
        if (field === joinOn) continue;
        row[`${source.alias}.${field}`] = value;
      }
    }
    return row;
  });

  const fields = [
    { id: joinOn, name: joinOn, type: "date" as const, description: "" },
    ...indexed.flatMap((source) =>
      source.payload.fields
        .filter((field) => field.id !== joinOn)
        .map((field) => ({
          ...field,
          id: `${source.alias}.${field.id}`,
          name: `${source.alias}.${field.name}`,
        })),
    ),
  ];

  return {
    fields,
    rows,
    _cachedAt: new Date().toISOString(),
    _source: `merge(${sources.map((s) => s.alias).join(",")})`,
  };
}

function coerceComparable(value: unknown): number | string {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) && value.trim() !== "" ? num : value;
  }
  return String(value);
}

const COMPARISON_OPERATORS = [">=", "<=", "!=", "==", ">", "<"] as const;

/**
 * Minimal, deliberately non-Turing-complete expression support -- no
 * eval()/new Function(), because module transformations are meant to stay
 * safe, declarative config (see PITCH.md's trust-tier split between
 * Modules and Adapters). Filter shape: "<field> <op> <value>".
 */
function evaluateFilter(row: Record<string, unknown>, expression: string): boolean {
  for (const op of COMPARISON_OPERATORS) {
    const opIndex = expression.indexOf(op);
    if (opIndex === -1) continue;
    const field = expression.slice(0, opIndex).trim();
    const rawValue = expression
      .slice(opIndex + op.length)
      .trim()
      .replace(/^["']|["']$/g, "");
    const left = coerceComparable(row[field]);
    const right = coerceComparable(rawValue);
    switch (op) {
      case ">":
        return left > right;
      case ">=":
        return left >= right;
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case "==":
        return left === right;
      case "!=":
        return left !== right;
    }
  }
  throw new Error(`Unsupported filter expression: "${expression}"`);
}

const ARITHMETIC_OPERATORS = ["+", "-", "*", "/"] as const;

/** Formula shape: "<newField> = <fieldA> <op> <fieldB>". Same no-eval constraint as filters. */
function applyFormula(row: Record<string, unknown>, expression: string): Record<string, unknown> {
  const [target, rhs] = expression.split("=").map((part) => part.trim());
  if (!target || !rhs) throw new Error(`Unsupported formula expression: "${expression}"`);

  for (const op of ARITHMETIC_OPERATORS) {
    const opIndex = rhs.indexOf(op);
    if (opIndex === -1) continue;
    const leftField = rhs.slice(0, opIndex).trim();
    const rightField = rhs.slice(opIndex + 1).trim();
    const left = Number(row[leftField] ?? leftField);
    const right = Number(row[rightField] ?? rightField);
    let value: number;
    switch (op) {
      case "+":
        value = left + right;
        break;
      case "-":
        value = left - right;
        break;
      case "*":
        value = left * right;
        break;
      case "/":
        value = left / right;
        break;
    }
    return { ...row, [target]: value };
  }
  throw new Error(`Unsupported formula expression: "${expression}"`);
}

export function applyTransformation(payload: DataPayload, transformation: Transformation): DataPayload {
  switch (transformation.kind) {
    case "filter":
      return {
        ...payload,
        rows: payload.rows.filter((row) => evaluateFilter(row, transformation.expression)),
      };
    case "formula":
      return {
        ...payload,
        rows: payload.rows.map((row) => applyFormula(row, transformation.expression)),
      };
    case "sort": {
      const { field, direction } = transformation;
      const sorted = [...payload.rows].sort((a, b) => {
        const left = coerceComparable(a[field]);
        const right = coerceComparable(b[field]);
        const cmp = left < right ? -1 : left > right ? 1 : 0;
        return direction === "asc" ? cmp : -cmp;
      });
      return { ...payload, rows: sorted };
    }
    case "group": {
      // Grouping with sum aggregation on every numeric field -- the
      // schema doesn't carry a per-field aggregation function yet, so
      // this is a deliberate, documented default rather than a richer
      // aggregation DSL that isn't needed yet.
      const { field } = transformation;
      const groups = new Map<string, Record<string, unknown>>();
      for (const row of payload.rows) {
        const key = String(row[field]);
        const existing = groups.get(key);
        if (!existing) {
          groups.set(key, { ...row });
          continue;
        }
        for (const [k, v] of Object.entries(row)) {
          if (k === field) continue;
          if (typeof v === "number" && typeof existing[k] === "number") {
            existing[k] = (existing[k] as number) + v;
          }
        }
      }
      return { ...payload, rows: [...groups.values()] };
    }
  }
}

export function runQueryPipeline(moduleDef: ModuleDefinition, sourceData: NamedDataPayload[]): DataPayload {
  let result: DataPayload;

  if (moduleDef.type === "merge") {
    if (!moduleDef.joinOn) throw new Error("merge module requires joinOn");
    result = mergeDataPayloads(sourceData, { joinOn: moduleDef.joinOn });
  } else {
    const [first] = sourceData;
    if (!first) throw new Error("single module requires exactly one data source");
    result = first.payload;
  }

  for (const transformation of moduleDef.transformations) {
    result = applyTransformation(result, transformation);
  }

  return result;
}
