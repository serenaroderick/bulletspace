import type { DataPayload, ModuleDefinition } from "../modules.js";
import type { AssetDefinition, ThemeDefinition } from "../theme.js";
import type { Board, CanvasElement, Entry, Journal } from "../types.js";

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

  createBoard(board: Board): Promise<void>;
  getBoard(id: string): Promise<Board | undefined>;
  listBoards(): Promise<Board[]>;
  updateBoard(id: string, patch: Partial<Board>): Promise<void>;
  deleteBoard(id: string): Promise<void>;

  createCanvasElement(element: CanvasElement): Promise<void>;
  listCanvasElementsByBoard(boardId: string): Promise<CanvasElement[]>;
  updateCanvasElement(id: string, patch: Partial<CanvasElement>): Promise<void>;
  deleteCanvasElement(id: string): Promise<void>;

  getCachedAdapterData(adapterId: string): Promise<AdapterCacheEntry | undefined>;
  setCachedAdapterData(entry: AdapterCacheEntry): Promise<void>;

  /** Imported (Phase 4 "manual sharing") module definitions -- not the hardcoded modules, which aren't data-driven. */
  createModuleDefinition(moduleDef: ModuleDefinition): Promise<void>;
  listModuleDefinitions(): Promise<ModuleDefinition[]>;
  deleteModuleDefinition(id: string): Promise<void>;

  /** Installed themes (Phase 5.5) -- built-in themes ship in apps/web's registry and never touch this; only imported/custom ones are persisted here. */
  createThemeDefinition(theme: ThemeDefinition): Promise<void>;
  listThemeDefinitions(): Promise<ThemeDefinition[]>;
  deleteThemeDefinition(id: string): Promise<void>;

  /** Installed asset packs (Phase 5.5) -- same split as themes: built-ins ship in the registry, imports land here. */
  createAssetDefinition(assetDef: AssetDefinition): Promise<void>;
  listAssetDefinitions(): Promise<AssetDefinition[]>;
  deleteAssetDefinition(id: string): Promise<void>;
}
