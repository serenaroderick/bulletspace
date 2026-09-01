import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { ModuleDefinition } from "../modules.js";
import type { AssetDefinition, ThemeDefinition } from "../theme.js";
import type { Board, CanvasElement, Entry, Journal } from "../types.js";
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
  boards: {
    key: string;
    value: Board;
  };
  canvasElements: {
    key: string;
    value: CanvasElement;
    indexes: { boardId: string };
  };
  adapterCache: {
    key: string;
    value: AdapterCacheEntry;
  };
  moduleDefinitions: {
    key: string;
    value: ModuleDefinition;
  };
  themeDefinitions: {
    key: string;
    value: ThemeDefinition;
  };
  assetDefinitions: {
    key: string;
    value: AssetDefinition;
  };
}

const DEFAULT_DB_NAME = "bulletspace";
const DB_VERSION = 5;

/**
 * Web adapter backed by IndexedDB. Requires a browser (or a browser-like
 * IndexedDB implementation, e.g. fake-indexeddb in tests).
 */
export class IndexedDBAdapter implements DatabaseAdapter {
  private db: IDBPDatabase<BulletSpaceDB> | null = null;

  constructor(private readonly dbName: string = DEFAULT_DB_NAME) {}

  async init(): Promise<void> {
    this.db = await openDB<BulletSpaceDB>(this.dbName, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("journals")) {
          db.createObjectStore("journals", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("entries")) {
          const entries = db.createObjectStore("entries", { keyPath: "id" });
          entries.createIndex("journalId", "journalId");
        }

        if (!db.objectStoreNames.contains("boards")) {
          db.createObjectStore("boards", { keyPath: "id" });
        }

        // v5: canvasElements moved from an `entryId` index to `boardId`
        // (Phase 6.2.5 -- the canvas is no longer per-entry). `idb` only
        // lets an index be created at store-creation time, so a pre-v5
        // store is dropped and recreated rather than migrated in place --
        // this drops any existing canvas elements on upgrade, acceptable
        // since there's no real user data riding on this yet.
        if (oldVersion < 5 && db.objectStoreNames.contains("canvasElements")) {
          db.deleteObjectStore("canvasElements");
        }
        if (!db.objectStoreNames.contains("canvasElements")) {
          const canvasElements = db.createObjectStore("canvasElements", { keyPath: "id" });
          canvasElements.createIndex("boardId", "boardId");
        }

        if (!db.objectStoreNames.contains("adapterCache")) {
          db.createObjectStore("adapterCache", { keyPath: "adapterId" });
        }

        if (!db.objectStoreNames.contains("moduleDefinitions")) {
          db.createObjectStore("moduleDefinitions", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("themeDefinitions")) {
          db.createObjectStore("themeDefinitions", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("assetDefinitions")) {
          db.createObjectStore("assetDefinitions", { keyPath: "id" });
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

  async createBoard(board: Board): Promise<void> {
    await this.connection.put("boards", board);
  }

  async getBoard(id: string): Promise<Board | undefined> {
    return this.connection.get("boards", id);
  }

  async listBoards(): Promise<Board[]> {
    return this.connection.getAll("boards");
  }

  async updateBoard(id: string, patch: Partial<Board>): Promise<void> {
    const existing = await this.getBoard(id);
    if (!existing) throw new Error(`Board not found: ${id}`);
    await this.connection.put("boards", { ...existing, ...patch });
  }

  async deleteBoard(id: string): Promise<void> {
    await this.connection.delete("boards", id);
  }

  async createCanvasElement(element: CanvasElement): Promise<void> {
    await this.connection.put("canvasElements", element);
  }

  async listCanvasElementsByBoard(boardId: string): Promise<CanvasElement[]> {
    return this.connection.getAllFromIndex("canvasElements", "boardId", boardId);
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

  async createModuleDefinition(moduleDef: ModuleDefinition): Promise<void> {
    await this.connection.put("moduleDefinitions", moduleDef);
  }

  async listModuleDefinitions(): Promise<ModuleDefinition[]> {
    return this.connection.getAll("moduleDefinitions");
  }

  async deleteModuleDefinition(id: string): Promise<void> {
    await this.connection.delete("moduleDefinitions", id);
  }

  async createThemeDefinition(theme: ThemeDefinition): Promise<void> {
    await this.connection.put("themeDefinitions", theme);
  }

  async listThemeDefinitions(): Promise<ThemeDefinition[]> {
    return this.connection.getAll("themeDefinitions");
  }

  async deleteThemeDefinition(id: string): Promise<void> {
    await this.connection.delete("themeDefinitions", id);
  }

  async createAssetDefinition(assetDef: AssetDefinition): Promise<void> {
    await this.connection.put("assetDefinitions", assetDef);
  }

  async listAssetDefinitions(): Promise<AssetDefinition[]> {
    return this.connection.getAll("assetDefinitions");
  }

  async deleteAssetDefinition(id: string): Promise<void> {
    await this.connection.delete("assetDefinitions", id);
  }
}
