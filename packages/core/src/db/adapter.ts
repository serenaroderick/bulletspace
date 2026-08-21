import type { DataPayload } from "../modules.js";
import type { CanvasElement, Entry, Journal } from "../types.js";

export interface AdapterCacheEntry {
  adapterId: string;
  payload: DataPayload;
  cachedAt: number;
}

export interface DatabaseAdapter {
  init(): Promise<void>;

  createJournal(journal: Journal): Promise<void>;
  getJournal(id: string): Promise<Journal | undefined>;
  listJournals(): Promise<Journal[]>;
  updateJournal(id: string, patch: Partial<Journal>): Promise<void>;
  deleteJournal(id: string): Promise<void>;

  createEntry(entry: Entry): Promise<void>;
  getEntry(id: string): Promise<Entry | undefined>;
  listEntriesByJournal(journalId: string): Promise<Entry[]>;
  updateEntry(id: string, patch: Partial<Entry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  createCanvasElement(element: CanvasElement): Promise<void>;
  listCanvasElementsByEntry(entryId: string): Promise<CanvasElement[]>;
  updateCanvasElement(id: string, patch: Partial<CanvasElement>): Promise<void>;
  deleteCanvasElement(id: string): Promise<void>;

  getCachedAdapterData(adapterId: string): Promise<AdapterCacheEntry | undefined>;
  setCachedAdapterData(entry: AdapterCacheEntry): Promise<void>;
}
