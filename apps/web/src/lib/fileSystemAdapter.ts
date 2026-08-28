import type {
  AdapterCacheEntry,
  AssetDefinition,
  CanvasElement,
  DatabaseAdapter,
  Entry,
  Journal,
  ModuleDefinition,
  ThemeDefinition,
} from "@bulletspace/core";
import { load, type Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "bulletspace.json";

function journalKey(id: string) {
  return `journal:${id}`;
}
function entryKey(id: string) {
  return `entry:${id}`;
}
function canvasElementKey(id: string) {
  return `canvasElement:${id}`;
}
function adapterCacheKey(adapterId: string) {
  return `adapterCache:${adapterId}`;
}
function moduleDefinitionKey(id: string) {
  return `moduleDefinition:${id}`;
}
function themeDefinitionKey(id: string) {
  return `themeDefinition:${id}`;
}
function assetDefinitionKey(id: string) {
  return `assetDefinition:${id}`;
}

/**
 * Desktop (Tauri) adapter backed by a single JSON file on disk via
 * @tauri-apps/plugin-store, replacing IndexedDB for the desktop build.
 * Collections are emulated with key prefixes over one flat store, so this
 * exposes exactly the same shape IndexedDBAdapter does -- callers don't
 * need to know which one they got. See lib/db.ts for the runtime switch.
 */
export class FileSystemAdapter implements DatabaseAdapter {
  private store: Store | null = null;

  async init(): Promise<void> {
    this.store = await load(STORE_FILE, { autoSave: true });
  }

  private get connection(): Store {
    if (!this.store) throw new Error("FileSystemAdapter used before init()");
    return this.store;
  }

  private async listByPrefix<T>(prefix: string): Promise<T[]> {
    const entries = await this.connection.entries<T>();
    return entries.filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
  }

  async createJournal(journal: Journal): Promise<void> {
    await this.connection.set(journalKey(journal.id), journal);
  }

  async getJournal(id: string): Promise<Journal | undefined> {
    return (await this.connection.get<Journal>(journalKey(id))) ?? undefined;
  }

  async listJournals(): Promise<Journal[]> {
    return this.listByPrefix<Journal>("journal:");
  }

  async updateJournal(id: string, patch: Partial<Journal>): Promise<void> {
    const existing = await this.getJournal(id);
    if (!existing) throw new Error(`Journal not found: ${id}`);
    await this.connection.set(journalKey(id), { ...existing, ...patch });
  }

  async deleteJournal(id: string): Promise<void> {
    await this.connection.delete(journalKey(id));
  }

  async createEntry(entry: Entry): Promise<void> {
    await this.connection.set(entryKey(entry.id), entry);
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    return (await this.connection.get<Entry>(entryKey(id))) ?? undefined;
  }

  async listEntriesByJournal(journalId: string): Promise<Entry[]> {
    const all = await this.listByPrefix<Entry>("entry:");
    return all.filter((entry) => entry.journalId === journalId);
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<void> {
    const existing = await this.getEntry(id);
    if (!existing) throw new Error(`Entry not found: ${id}`);
    await this.connection.set(entryKey(id), { ...existing, ...patch });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.connection.delete(entryKey(id));
  }

  async createCanvasElement(element: CanvasElement): Promise<void> {
    await this.connection.set(canvasElementKey(element.id), element);
  }

  async listCanvasElementsByEntry(entryId: string): Promise<CanvasElement[]> {
    const all = await this.listByPrefix<CanvasElement>("canvasElement:");
    return all.filter((element) => element.entryId === entryId);
  }

  async updateCanvasElement(id: string, patch: Partial<CanvasElement>): Promise<void> {
    const existing = await this.connection.get<CanvasElement>(canvasElementKey(id));
    if (!existing) throw new Error(`Canvas element not found: ${id}`);
    await this.connection.set(canvasElementKey(id), { ...existing, ...patch });
  }

  async deleteCanvasElement(id: string): Promise<void> {
    await this.connection.delete(canvasElementKey(id));
  }

  async getCachedAdapterData(adapterId: string): Promise<AdapterCacheEntry | undefined> {
    return (await this.connection.get<AdapterCacheEntry>(adapterCacheKey(adapterId))) ?? undefined;
  }

  async setCachedAdapterData(entry: AdapterCacheEntry): Promise<void> {
    await this.connection.set(adapterCacheKey(entry.adapterId), entry);
  }

  async createModuleDefinition(moduleDef: ModuleDefinition): Promise<void> {
    await this.connection.set(moduleDefinitionKey(moduleDef.id), moduleDef);
  }

  async listModuleDefinitions(): Promise<ModuleDefinition[]> {
    return this.listByPrefix<ModuleDefinition>("moduleDefinition:");
  }

  async deleteModuleDefinition(id: string): Promise<void> {
    await this.connection.delete(moduleDefinitionKey(id));
  }

  async createThemeDefinition(theme: ThemeDefinition): Promise<void> {
    await this.connection.set(themeDefinitionKey(theme.id), theme);
  }

  async listThemeDefinitions(): Promise<ThemeDefinition[]> {
    return this.listByPrefix<ThemeDefinition>("themeDefinition:");
  }

  async deleteThemeDefinition(id: string): Promise<void> {
    await this.connection.delete(themeDefinitionKey(id));
  }

  async createAssetDefinition(assetDef: AssetDefinition): Promise<void> {
    await this.connection.set(assetDefinitionKey(assetDef.id), assetDef);
  }

  async listAssetDefinitions(): Promise<AssetDefinition[]> {
    return this.listByPrefix<AssetDefinition>("assetDefinition:");
  }

  async deleteAssetDefinition(id: string): Promise<void> {
    await this.connection.delete(assetDefinitionKey(id));
  }
}
