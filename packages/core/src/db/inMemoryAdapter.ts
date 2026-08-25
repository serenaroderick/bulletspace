import type { ModuleDefinition } from "../modules.js";
import type { CanvasElement, Entry, Journal } from "../types.js";
import type { AdapterCacheEntry, DatabaseAdapter } from "./adapter.js";

/**
 * Reference implementation used in tests and as a fallback. Not persisted.
 */
export class InMemoryAdapter implements DatabaseAdapter {
  private journals = new Map<string, Journal>();
  private entries = new Map<string, Entry>();
  private canvasElements = new Map<string, CanvasElement>();
  private adapterCache = new Map<string, AdapterCacheEntry>();
  private moduleDefinitions = new Map<string, ModuleDefinition>();

  async init(): Promise<void> {
    // Nothing to initialize for an in-memory store.
  }

  async createJournal(journal: Journal): Promise<void> {
    this.journals.set(journal.id, journal);
  }

  async getJournal(id: string): Promise<Journal | undefined> {
    return this.journals.get(id);
  }

  async listJournals(): Promise<Journal[]> {
    return [...this.journals.values()];
  }

  async updateJournal(id: string, patch: Partial<Journal>): Promise<void> {
    const existing = this.journals.get(id);
    if (!existing) throw new Error(`Journal not found: ${id}`);
    this.journals.set(id, { ...existing, ...patch });
  }

  async deleteJournal(id: string): Promise<void> {
    this.journals.delete(id);
  }

  async createEntry(entry: Entry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    return this.entries.get(id);
  }

  async listEntriesByJournal(journalId: string): Promise<Entry[]> {
    return [...this.entries.values()].filter((entry) => entry.journalId === journalId);
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<void> {
    const existing = this.entries.get(id);
    if (!existing) throw new Error(`Entry not found: ${id}`);
    this.entries.set(id, { ...existing, ...patch });
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async createCanvasElement(element: CanvasElement): Promise<void> {
    this.canvasElements.set(element.id, element);
  }

  async listCanvasElementsByEntry(entryId: string): Promise<CanvasElement[]> {
    return [...this.canvasElements.values()].filter((element) => element.entryId === entryId);
  }

  async updateCanvasElement(id: string, patch: Partial<CanvasElement>): Promise<void> {
    const existing = this.canvasElements.get(id);
    if (!existing) throw new Error(`Canvas element not found: ${id}`);
    this.canvasElements.set(id, { ...existing, ...patch });
  }

  async deleteCanvasElement(id: string): Promise<void> {
    this.canvasElements.delete(id);
  }

  async getCachedAdapterData(adapterId: string): Promise<AdapterCacheEntry | undefined> {
    return this.adapterCache.get(adapterId);
  }

  async setCachedAdapterData(entry: AdapterCacheEntry): Promise<void> {
    this.adapterCache.set(entry.adapterId, entry);
  }

  async createModuleDefinition(moduleDef: ModuleDefinition): Promise<void> {
    this.moduleDefinitions.set(moduleDef.id, moduleDef);
  }

  async listModuleDefinitions(): Promise<ModuleDefinition[]> {
    return [...this.moduleDefinitions.values()];
  }

  async deleteModuleDefinition(id: string): Promise<void> {
    this.moduleDefinitions.delete(id);
  }
}
