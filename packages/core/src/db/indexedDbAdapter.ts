import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { CanvasElement, Entry, Journal } from "../types.js";
import type { AdapterCacheEntry, DatabaseAdapter } from "./adapter.js";

interface BulletSpaceDB extends DBSchema {
  journals: {
    key: string;
    value: Journal;
  };
  entries: {
    key: string;
    value: Entry;
    indexes: { journalId: string };
  };
  canvasElements: {
    key: string;
    value: CanvasElement;
    indexes: { entryId: string };
  };
  adapterCache: {
    key: string;
    value: AdapterCacheEntry;
  };
}

const DEFAULT_DB_NAME = "bulletspace";
const DB_VERSION = 2;

/**
 * Web adapter backed by IndexedDB. Requires a browser (or a browser-like
 * IndexedDB implementation, e.g. fake-indexeddb in tests).
 */
export class IndexedDBAdapter implements DatabaseAdapter {
  private db: IDBPDatabase<BulletSpaceDB> | null = null;

  constructor(private readonly dbName: string = DEFAULT_DB_NAME) {}

  async init(): Promise<void> {
    this.db = await openDB<BulletSpaceDB>(this.dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("journals")) {
          db.createObjectStore("journals", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("entries")) {
          const entries = db.createObjectStore("entries", { keyPath: "id" });
          entries.createIndex("journalId", "journalId");
        }

        if (!db.objectStoreNames.contains("canvasElements")) {
          const canvasElements = db.createObjectStore("canvasElements", { keyPath: "id" });
          canvasElements.createIndex("entryId", "entryId");
        }

        if (!db.objectStoreNames.contains("adapterCache")) {
          db.createObjectStore("adapterCache", { keyPath: "adapterId" });
        }
      },
    });
  }

  private get connection(): IDBPDatabase<BulletSpaceDB> {
    if (!this.db) throw new Error("IndexedDBAdapter used before init()");
    return this.db;
  }

  async createJournal(journal: Journal): Promise<void> {
    await this.connection.put("journals", journal);
  }

  async getJournal(id: string): Promise<Journal | undefined> {
    return this.connection.get("journals", id);
  }

  async listJournals(): Promise<Journal[]> {
    return this.connection.getAll("journals");
  }

  async updateJournal(id: string, patch: Partial<Journal>): Promise<void> {
    const existing = await this.getJournal(id);
    if (!existing) throw new Error(`Journal not found: ${id}`);
    await this.connection.put("journals", { ...existing, ...patch });
  }

  async deleteJournal(id: string): Promise<void> {
    await this.connection.delete("journals", id);
  }

  async createEntry(entry: Entry): Promise<void> {
    await this.connection.put("entries", entry);
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    return this.connection.get("entries", id);
  }

  async listEntriesByJournal(journalId: string): Promise<Entry[]> {
    return this.connection.getAllFromIndex("entries", "journalId", journalId);
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<void> {
    const existing = await this.getEntry(id);
    if (!existing) throw new Error(`Entry not found: ${id}`);
    await this.connection.put("entries", { ...existing, ...patch });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.connection.delete("entries", id);
  }

  async createCanvasElement(element: CanvasElement): Promise<void> {
    await this.connection.put("canvasElements", element);
  }

  async listCanvasElementsByEntry(entryId: string): Promise<CanvasElement[]> {
    return this.connection.getAllFromIndex("canvasElements", "entryId", entryId);
  }

  async updateCanvasElement(id: string, patch: Partial<CanvasElement>): Promise<void> {
    const existing = await this.connection.get("canvasElements", id);
    if (!existing) throw new Error(`Canvas element not found: ${id}`);
    await this.connection.put("canvasElements", { ...existing, ...patch });
  }

  async deleteCanvasElement(id: string): Promise<void> {
    await this.connection.delete("canvasElements", id);
  }

  async getCachedAdapterData(adapterId: string): Promise<AdapterCacheEntry | undefined> {
    return this.connection.get("adapterCache", adapterId);
  }

  async setCachedAdapterData(entry: AdapterCacheEntry): Promise<void> {
    await this.connection.put("adapterCache", entry);
  }
}
