import type { Board, DatabaseAdapter } from "@bulletspace/core";
import { defaultCanvasConfig } from "./canvasPage";

function newId(): string {
  return crypto.randomUUID();
}

let defaultBoardPromise: Promise<Board> | null = null;

/**
 * Finds or creates the app's single default board. Memoized for the same
 * reason ensureDefaultJournal is: React 18 StrictMode's dev-mode
 * double-invoke (or any other concurrent caller) could otherwise race two
 * "no board exists yet" checks into creating duplicates.
 */
export function ensureDefaultBoard(adapter: DatabaseAdapter): Promise<Board> {
  if (!defaultBoardPromise) {
    defaultBoardPromise = (async () => {
      const boards = await adapter.listBoards();
      if (boards[0]) return boards[0];

      const now = Date.now();
      const created: Board = {
        id: newId(),
        name: "Dashboard",
        canvasConfig: defaultCanvasConfig(),
        createdAt: now,
        updatedAt: now,
      };
      await adapter.createBoard(created);
      return created;
    })();
  }
  return defaultBoardPromise;
}

/** Test-only: clears the memoized promise between test cases. */
export function resetDefaultBoardCache(): void {
  defaultBoardPromise = null;
}
