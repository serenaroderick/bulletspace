import { beforeEach, describe, expect, it } from "vitest";
import type { ModuleDefinition } from "../modules.js";
import type { AssetDefinition, ThemeDefinition } from "../theme.js";
import type { CanvasElement, Entry, Journal } from "../types.js";
import type { DatabaseAdapter } from "./adapter.js";
import { IndexedDBAdapter } from "./indexedDbAdapter.js";
import { InMemoryAdapter } from "./inMemoryAdapter.js";

function makeJournal(overrides: Partial<Journal> = {}): Journal {
  return {
    id: "journal-1",
    title: "Daily Log",
    icon: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    journalId: "journal-1",
    title: "2026-08-20",
    content: "# Today\n",
    canvasConfig: {
      width: 4000,
      height: 4000,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      grid: { style: "dot", spacing: 24, color: "#dddddd", opacity: 0.7 },
      canvasBackground: { type: "color", value: "#ffffff" },
      parallax: { enabled: true, backgroundSpeed: 0.3, photoSpeed: 0.7 },
      snapToGrid: true,
      editMode: true,
    },
    mood: null,
    energy: null,
    focus: null,
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCanvasElement(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: "element-1",
    entryId: "entry-1",
    type: "text",
    content: { markdown: "hello" },
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    zIndex: 0,
    rotation: 0,
    opacity: 1,
    ...overrides,
  };
}

function makeModuleDefinition(overrides: Partial<ModuleDefinition> = {}): ModuleDefinition {
  return {
    id: "shared-module-1",
    name: "Shared Module",
    version: "1.0.0",
    type: "single",
    sources: [{ adapterId: "journal", alias: "mood" }],
    transformations: [],
    output: { type: "table", config: {} },
    ...overrides,
  };
}

function makeThemeDefinition(overrides: Partial<ThemeDefinition> = {}): ThemeDefinition {
  return {
    id: "theme-1",
    name: "Test Theme",
    version: "1.0.0",
    colors: {
      background: "#ffffff",
      surface: "#f5f5f5",
      text: "#111111",
      textMuted: "#666666",
      accent: "#3366ff",
      border: "#dddddd",
    },
    fontFamily: "sans-serif",
    spacingUnit: 8,
    cornerRadius: 6,
    lineThickness: 1,
    ...overrides,
  };
}

function makeAssetDefinition(overrides: Partial<AssetDefinition> = {}): AssetDefinition {
  return {
    id: "assets-1",
    name: "Test Pack",
    version: "1.0.0",
    items: [{ id: "star", name: "Star", kind: "sticker", src: "⭐" }],
    ...overrides,
  };
}

let indexedDbTestCounter = 0;

const adapters: Array<[string, () => DatabaseAdapter]> = [
  ["InMemoryAdapter", () => new InMemoryAdapter()],
  ["IndexedDBAdapter", () => new IndexedDBAdapter(`bulletspace-test-${indexedDbTestCounter++}`)],
];

describe.each(adapters)("%s", (_name, createAdapter) => {
  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    adapter = createAdapter();
    await adapter.init();
  });

  it("creates and retrieves a journal", async () => {
    await adapter.createJournal(makeJournal());
    const journal = await adapter.getJournal("journal-1");
    expect(journal).toMatchObject({ id: "journal-1", title: "Daily Log" });
  });

  it("lists all journals", async () => {
    await adapter.createJournal(makeJournal({ id: "journal-1" }));
    await adapter.createJournal(makeJournal({ id: "journal-2", title: "Work" }));
    const journals = await adapter.listJournals();
    expect(journals).toHaveLength(2);
  });

  it("updates a journal", async () => {
    await adapter.createJournal(makeJournal());
    await adapter.updateJournal("journal-1", { title: "Renamed" });
    const journal = await adapter.getJournal("journal-1");
    expect(journal?.title).toBe("Renamed");
  });

  it("deletes a journal", async () => {
    await adapter.createJournal(makeJournal());
    await adapter.deleteJournal("journal-1");
    expect(await adapter.getJournal("journal-1")).toBeUndefined();
  });

  it("creates entries and lists them by journal", async () => {
    await adapter.createJournal(makeJournal());
    await adapter.createEntry(makeEntry({ id: "entry-1" }));
    await adapter.createEntry(makeEntry({ id: "entry-2" }));
    const entries = await adapter.listEntriesByJournal("journal-1");
    expect(entries.map((entry) => entry.id).sort()).toEqual(["entry-1", "entry-2"]);
  });

  it("updates and deletes an entry", async () => {
    await adapter.createEntry(makeEntry());
    await adapter.updateEntry("entry-1", { mood: 8 });
    expect((await adapter.getEntry("entry-1"))?.mood).toBe(8);

    await adapter.deleteEntry("entry-1");
    expect(await adapter.getEntry("entry-1")).toBeUndefined();
  });

  it("creates canvas elements and lists them by entry", async () => {
    await adapter.createEntry(makeEntry());
    await adapter.createCanvasElement(makeCanvasElement({ id: "element-1" }));
    await adapter.createCanvasElement(makeCanvasElement({ id: "element-2", type: "table" }));

    const elements = await adapter.listCanvasElementsByEntry("entry-1");
    expect(elements).toHaveLength(2);
  });

  it("updates and deletes a canvas element", async () => {
    await adapter.createCanvasElement(makeCanvasElement());
    await adapter.updateCanvasElement("element-1", { x: 50, y: 75 });
    const elements = await adapter.listCanvasElementsByEntry("entry-1");
    expect(elements[0]).toMatchObject({ x: 50, y: 75 });

    await adapter.deleteCanvasElement("element-1");
    expect(await adapter.listCanvasElementsByEntry("entry-1")).toHaveLength(0);
  });

  it("throws when updating a journal that does not exist", async () => {
    await expect(adapter.updateJournal("missing", { title: "x" })).rejects.toThrow();
  });

  it("returns undefined for uncached adapter data", async () => {
    expect(await adapter.getCachedAdapterData("weather-v1")).toBeUndefined();
  });

  it("caches and retrieves adapter data", async () => {
    const entry = {
      adapterId: "weather-v1",
      payload: {
        fields: [{ id: "temp", name: "Temp", type: "number" as const, description: "" }],
        rows: [{ temp: 20 }],
        _cachedAt: new Date(0).toISOString(),
        _source: "weather-v1",
      },
      cachedAt: 1000,
    };
    await adapter.setCachedAdapterData(entry);
    expect(await adapter.getCachedAdapterData("weather-v1")).toEqual(entry);
  });

  it("overwrites cached adapter data for the same adapter id", async () => {
    const makeCacheEntry = (cachedAt: number) => ({
      adapterId: "weather-v1",
      payload: {
        fields: [],
        rows: [],
        _cachedAt: new Date(cachedAt).toISOString(),
        _source: "weather-v1",
      },
      cachedAt,
    });
    await adapter.setCachedAdapterData(makeCacheEntry(1000));
    await adapter.setCachedAdapterData(makeCacheEntry(2000));
    expect((await adapter.getCachedAdapterData("weather-v1"))?.cachedAt).toBe(2000);
  });

  it("creates and lists imported module definitions", async () => {
    await adapter.createModuleDefinition(makeModuleDefinition({ id: "m1" }));
    await adapter.createModuleDefinition(makeModuleDefinition({ id: "m2", name: "Other" }));
    const defs = await adapter.listModuleDefinitions();
    expect(defs.map((d) => d.id).sort()).toEqual(["m1", "m2"]);
  });

  it("deletes an imported module definition", async () => {
    await adapter.createModuleDefinition(makeModuleDefinition({ id: "m1" }));
    await adapter.deleteModuleDefinition("m1");
    expect(await adapter.listModuleDefinitions()).toHaveLength(0);
  });

  it("creates and lists installed themes", async () => {
    await adapter.createThemeDefinition(makeThemeDefinition({ id: "t1" }));
    await adapter.createThemeDefinition(makeThemeDefinition({ id: "t2", name: "Other" }));
    const themes = await adapter.listThemeDefinitions();
    expect(themes.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
  });

  it("deletes an installed theme", async () => {
    await adapter.createThemeDefinition(makeThemeDefinition({ id: "t1" }));
    await adapter.deleteThemeDefinition("t1");
    expect(await adapter.listThemeDefinitions()).toHaveLength(0);
  });

  it("creates and lists installed asset packs", async () => {
    await adapter.createAssetDefinition(makeAssetDefinition({ id: "a1" }));
    await adapter.createAssetDefinition(makeAssetDefinition({ id: "a2", name: "Other" }));
    const packs = await adapter.listAssetDefinitions();
    expect(packs.map((p) => p.id).sort()).toEqual(["a1", "a2"]);
  });

  it("deletes an installed asset pack", async () => {
    await adapter.createAssetDefinition(makeAssetDefinition({ id: "a1" }));
    await adapter.deleteAssetDefinition("a1");
    expect(await adapter.listAssetDefinitions()).toHaveLength(0);
  });
});
