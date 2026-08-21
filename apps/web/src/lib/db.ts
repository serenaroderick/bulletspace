import { IndexedDBAdapter } from "@bulletspace/core";

export const db = new IndexedDBAdapter();

let initPromise: Promise<void> | null = null;

export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) initPromise = db.init();
  return initPromise;
}
