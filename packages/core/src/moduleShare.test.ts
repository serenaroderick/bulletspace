import { describe, expect, it } from "vitest";
import {
  checkRequiredAdapters,
  parseModuleShare,
  serializeModuleShare,
} from "./moduleShare.js";
import type { AdapterDefinition, ModuleDefinition } from "./modules.js";

const journalAdapter: AdapterDefinition = {
  id: "journal",
  name: "Journal Entries",
  version: "1.0.0",
  authType: "none",
  defaultTtlSeconds: 0,
  fields: [],
};

const weatherAdapter: AdapterDefinition = {
  id: "weather-v1",
  name: "Current Weather",
  version: "1.0.0",
  authType: "api_key",
  defaultTtlSeconds: 1800,
  fields: [],
};

const moodVsWeather: ModuleDefinition = {
  id: "mood-vs-weather",
  name: "Mood vs. Weather",
  version: "1.0.0",
  type: "merge",
  sources: [
    { adapterId: "journal", alias: "mood" },
    { adapterId: "weather-v1", alias: "weather" },
  ],
  joinOn: "date",
  transformations: [],
  output: { type: "chart", config: { chartType: "scatter", x: "weather.temperature_c", y: "mood.rating" } },
};

describe("serializeModuleShare / parseModuleShare", () => {
  it("round-trips a module definition with its required adapter manifest", () => {
    const share = serializeModuleShare(moodVsWeather, [journalAdapter, weatherAdapter]);
    const raw = JSON.stringify(share);
    const parsed = parseModuleShare(raw);

    expect(parsed).toEqual(share);
    expect(parsed.requiredAdapters).toEqual([
      { id: "journal", name: "Journal Entries", version: "1.0.0" },
      { id: "weather-v1", name: "Current Weather", version: "1.0.0" },
    ]);
  });

  it("does not include adapter code or fields, only id/name/version", () => {
    const share = serializeModuleShare(moodVsWeather, [journalAdapter, weatherAdapter]);
    for (const required of share.requiredAdapters) {
      expect(Object.keys(required).sort()).toEqual(["id", "name", "version"]);
    }
  });

  it("silently drops sources referencing an unknown adapter from the manifest", () => {
    const share = serializeModuleShare(moodVsWeather, [weatherAdapter]);
    expect(share.requiredAdapters).toEqual([{ id: "weather-v1", name: "Current Weather", version: "1.0.0" }]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseModuleShare("not json")).toThrow("Not valid JSON.");
  });

  it("rejects an unsupported version", () => {
    const share = serializeModuleShare(moodVsWeather, [journalAdapter, weatherAdapter]);
    expect(() => parseModuleShare(JSON.stringify({ ...share, version: 2 }))).toThrow(
      "Not a valid BulletSpace module share file.",
    );
  });

  it("rejects a module missing required fields", () => {
    const malformed = { version: 1, module: { id: "x" }, requiredAdapters: [] };
    expect(() => parseModuleShare(JSON.stringify(malformed))).toThrow(
      "Not a valid BulletSpace module share file.",
    );
  });
});

describe("checkRequiredAdapters", () => {
  it("marks adapters as available or missing based on what's installed", () => {
    const share = serializeModuleShare(moodVsWeather, [journalAdapter, weatherAdapter]);
    const result = checkRequiredAdapters(share, ["journal"]);

    expect(result).toEqual([
      { id: "journal", name: "Journal Entries", available: true },
      { id: "weather-v1", name: "Current Weather", available: false },
    ]);
  });
});
