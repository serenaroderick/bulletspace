import { describe, expect, it } from "vitest";
import type { DataPayload, Field, ModuleDefinition } from "./modules.js";
import { applyTransformation, mergeDataPayloads, runQueryPipeline } from "./queryEngine.js";

const dateField: Field = { id: "date", name: "Date", type: "date", description: "" };
const numField = (id: string): Field => ({ id, name: id, type: "number", description: "" });

function payload(fields: Field[], rows: Record<string, unknown>[]): DataPayload {
  return { fields, rows, _cachedAt: new Date(0).toISOString(), _source: "test" };
}

describe("mergeDataPayloads", () => {
  const mood = payload([dateField, numField("rating")], [
    { date: "2026-01-01T08:00:00Z", rating: 7 },
    { date: "2026-01-02T08:00:00Z", rating: 4 },
  ]);
  const weather = payload([dateField, numField("temperature_c")], [
    { date: "2026-01-01T18:00:00Z", temperature_c: 20 },
    { date: "2026-01-03T18:00:00Z", temperature_c: 15 },
  ]);

  it("inner-joins on day granularity by default, keeping only matching dates", () => {
    const merged = mergeDataPayloads(
      [
        { alias: "mood", payload: mood },
        { alias: "weather", payload: weather },
      ],
      { joinOn: "date" },
    );

    expect(merged.rows).toEqual([
      { date: "2026-01-01", "mood.rating": 7, "weather.temperature_c": 20 },
    ]);
  });

  it("left-joins from the first source, leaving unmatched fields absent", () => {
    const merged = mergeDataPayloads(
      [
        { alias: "mood", payload: mood },
        { alias: "weather", payload: weather },
      ],
      { joinOn: "date", joinType: "left" },
    );

    expect(merged.rows).toEqual([
      { date: "2026-01-01", "mood.rating": 7, "weather.temperature_c": 20 },
      { date: "2026-01-02", "mood.rating": 4 },
    ]);
  });

  it("namespaces fields by alias and keeps the join key unprefixed", () => {
    const merged = mergeDataPayloads(
      [
        { alias: "mood", payload: mood },
        { alias: "weather", payload: weather },
      ],
      { joinOn: "date" },
    );

    expect(merged.fields.map((f) => f.id)).toEqual(["date", "mood.rating", "weather.temperature_c"]);
  });

  it("uses only the first row per join key when a source has duplicates", () => {
    const dup = payload([dateField, numField("rating")], [
      { date: "2026-01-01T01:00:00Z", rating: 1 },
      { date: "2026-01-01T02:00:00Z", rating: 99 },
    ]);
    const merged = mergeDataPayloads([{ alias: "dup", payload: dup }], { joinOn: "date" });
    expect(merged.rows).toEqual([{ date: "2026-01-01", "dup.rating": 1 }]);
  });

  it("returns an empty payload for zero sources", () => {
    const merged = mergeDataPayloads([], { joinOn: "date" });
    expect(merged.rows).toEqual([]);
  });
});

describe("applyTransformation", () => {
  const base = payload(
    [numField("a"), numField("b"), { id: "label", name: "Label", type: "string", description: "" }],
    [
      { a: 1, b: 10, label: "x" },
      { a: 5, b: 20, label: "y" },
      { a: 3, b: 30, label: "x" },
    ],
  );

  it("filters rows with a numeric comparison", () => {
    const result = applyTransformation(base, { kind: "filter", expression: "a > 2" });
    expect(result.rows).toEqual([
      { a: 5, b: 20, label: "y" },
      { a: 3, b: 30, label: "x" },
    ]);
  });

  it("filters rows with a string equality comparison", () => {
    const result = applyTransformation(base, { kind: "filter", expression: 'label == "x"' });
    expect(result.rows.map((r) => r.a)).toEqual([1, 3]);
  });

  it("computes a formula field via addition", () => {
    const result = applyTransformation(base, { kind: "formula", expression: "total = a + b" });
    expect(result.rows.map((r) => r.total)).toEqual([11, 25, 33]);
  });

  it("sorts ascending and descending", () => {
    const asc = applyTransformation(base, { kind: "sort", field: "a", direction: "asc" });
    expect(asc.rows.map((r) => r.a)).toEqual([1, 3, 5]);

    const desc = applyTransformation(base, { kind: "sort", field: "a", direction: "desc" });
    expect(desc.rows.map((r) => r.a)).toEqual([5, 3, 1]);
  });

  it("groups by a field, summing numeric fields", () => {
    const result = applyTransformation(base, { kind: "group", field: "label" });
    expect(result.rows).toEqual([
      { a: 4, b: 40, label: "x" },
      { a: 5, b: 20, label: "y" },
    ]);
  });
});

describe("runQueryPipeline", () => {
  it("runs a single-source module through its transformations in order", () => {
    const moduleDef: ModuleDefinition = {
      id: "m1",
      name: "Test",
      version: "1.0.0",
      type: "single",
      sources: [{ adapterId: "a1", alias: "mood" }],
      transformations: [
        { kind: "filter", expression: "rating > 3" },
        { kind: "sort", field: "rating", direction: "desc" },
      ],
      output: { type: "table", config: {} },
    };

    const source = payload([numField("rating")], [{ rating: 2 }, { rating: 8 }, { rating: 5 }]);
    const result = runQueryPipeline(moduleDef, [{ alias: "mood", payload: source }]);
    expect(result.rows.map((r) => r.rating)).toEqual([8, 5]);
  });

  it("runs a merge module end to end: join then filter", () => {
    const moduleDef: ModuleDefinition = {
      id: "m2",
      name: "Mood vs Weather",
      version: "1.0.0",
      type: "merge",
      sources: [
        { adapterId: "journal", alias: "mood" },
        { adapterId: "weather-v1", alias: "weather" },
      ],
      joinOn: "date",
      transformations: [{ kind: "filter", expression: "mood.rating >= 5" }],
      output: { type: "chart", config: { chartType: "scatter" } },
    };

    const mood = payload([dateField, numField("rating")], [
      { date: "2026-01-01", rating: 7 },
      { date: "2026-01-02", rating: 2 },
    ]);
    const weather = payload([dateField, numField("temperature_c")], [
      { date: "2026-01-01", temperature_c: 20 },
      { date: "2026-01-02", temperature_c: 5 },
    ]);

    const result = runQueryPipeline(moduleDef, [
      { alias: "mood", payload: mood },
      { alias: "weather", payload: weather },
    ]);

    expect(result.rows).toEqual([{ date: "2026-01-01", "mood.rating": 7, "weather.temperature_c": 20 }]);
  });
});
