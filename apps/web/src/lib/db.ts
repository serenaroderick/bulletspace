import { type DatabaseAdapter, IndexedDBAdapter } from "@bulletspace/core";
import { FileSystemAdapter } from "./fileSystemAdapter";
import { isTauri } from "./platform";

export const db: DatabaseAdapter = isTauri() ? new FileSystemAdapter() : new IndexedDBAdapter();

let initPromise: Promise<void> | null = null;

export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) initPromise = db.init();
  return initPromise;
}
