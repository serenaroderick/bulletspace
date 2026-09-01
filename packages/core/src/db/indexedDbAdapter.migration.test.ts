import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { IndexedDBAdapter } from "./indexedDbAdapter.js";

/**
 * Simulates a real upgrade from a pre-Phase-6.2.5 database (DB_VERSION 4,
 * canvasElements keyed by an `entryId` index) to today's schema
 * (DB_VERSION 5, `boardId`). The parity suite in adapter.test.ts always
 * opens a brand-new database per test, so it never actually exercises an
 * upgrade -- this is the one test that does, since `idb` only allows an
 * index to be created at store-creation time, making this migration the
 * one genuinely fiddly part of the Board rename (see indexedDbAdapter.ts).
 */
describe("IndexedDBAdapter v4 -> v5 upgrade", () => {
  it("drops the old entryId-indexed canvasElements store and recreates it with a boardId index", async () => {
    const dbName = `bulletspace-migration-test-${Date.now()}`;

    const v4 = await openDB(dbName, 4, {
      upgrade(db) {
        db.createObjectStore("journals", { keyPath: "id" });
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("journalId", "journalId");
        const canvasElements = db.createObjectStore("canvasElements", { keyPath: "id" });
        canvasElements.createIndex("entryId", "entryId");
        db.createObjectStore("adapterCache", { keyPath: "adapterId" });
        db.createObjectStore("moduleDefinitions", { keyPath: "id" });
        db.createObjectStore("themeDefinitions", { keyPath: "id" });
        db.createObjectStore("assetDefinitions", { keyPath: "id" });
      },
    });
    await v4.put("canvasElements", { id: "old-sticker", entryId: "old-entry", type: "sticker" });
    v4.close();

    const adapter = new IndexedDBAdapter(dbName);
    await expect(adapter.init()).resolves.toBeUndefined();

    // Pre-v5 data (keyed by the now-gone entryId index) doesn't carry
    // forward -- documented, acceptable, matches the "blank canvas" intent.
    expect(await adapter.listCanvasElementsByBoard("old-entry")).toHaveLength(0);

    // The new boardId index actually works post-upgrade, and the new
    // boards store exists and round-trips.
    await adapter.createBoard({
      id: "board-1",
      name: "Dashboard",
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
      createdAt: 1,
      updatedAt: 1,
    });
    await adapter.createCanvasElement({
      id: "new-sticker",
      boardId: "board-1",
      type: "sticker",
      content: {},
      x: 0,
      y: 0,
      width: 48,
      height: 48,
      zIndex: 0,
      rotation: 0,
      opacity: 1,
      groupId: null,
    });

    const elements = await adapter.listCanvasElementsByBoard("board-1");
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe("new-sticker");
  });
});
