import { type DatabaseAdapter, IndexedDBAdapter } from "@bulletspace/core";
import { FileSystemAdapter } from "./fileSystemAdapter";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const db: DatabaseAdapter = isTauri() ? new FileSystemAdapter() : new IndexedDBAdapter();

let initPromise: Promise<void> | null = null;

export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) initPromise = db.init();
  return initPromise;
}
