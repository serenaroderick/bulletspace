import { beforeEach, describe, expect, it } from "vitest";
import type { ModuleDefinition } from "../modules.js";
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
    canvasConfig: { gridType: "dot", zoom: 1, scrollX: 0, scrollY: 0 },
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
});
