import type { Entry, Journal, ModuleDefinition, NetworkState, ThemeDefinition } from "@bulletspace/core";
import { createContext, type ReactNode, useContext } from "react";

export interface BoardContextValue {
  entries: Entry[];
  networkState: NetworkState;
  journal: Journal;
  onEntriesChanged: () => void;
  onOpenEntry: (entryId: string) => void;
  sharedModules: ModuleDefinition[];
  onSharedModulesChange: () => void;
  themes: ThemeDefinition[];
  activeTheme: ThemeDefinition;
  onThemesChange: () => void;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardContextProvider({ value, children }: { value: BoardContextValue; children: ReactNode }) {
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

/** Only meaningful inside BoardCanvas, which App.tsx always wraps in a BoardContextProvider. */
export function useBoardContext(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoardContext() called outside a BoardContextProvider");
  return value;
}
