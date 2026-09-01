import type { Board, CanvasConfig, Entry, Journal, ModuleDefinition, NetworkState, ThemeDefinition } from "@bulletspace/core";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { AccountPanel } from "./components/AccountPanel";
import { BoardCanvas } from "./components/BoardCanvas";
import { BoardContextProvider } from "./components/BoardContext";
import { EntryView } from "./components/EntryView";
import { NetworkToggle } from "./components/NetworkToggle";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { ensureDefaultBoard } from "./lib/board";
import { db, ensureDbInitialized } from "./lib/db";
import { exportJournal } from "./lib/exportFile";
import { gatekeeper } from "./lib/gatekeeper";
import { parseJournalExport } from "./lib/importExport";
import { ensureDefaultJournal } from "./lib/journal";
import { isTauri } from "./lib/platform";
import type { PulledJournal } from "./lib/sync";
import { applyThemeToDocument, listAllThemes, loadActiveThemeId, saveActiveThemeId } from "./lib/theme";
import { defaultLightTheme } from "./themes/registry";

function newId(): string {
  return crypto.randomUUID();
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [networkState, setNetworkState] = useState<NetworkState>(gatekeeper.getState());
  const [viewEntryId, setViewEntryId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [sharedModules, setSharedModules] = useState<ModuleDefinition[]>([]);
  const [themes, setThemes] = useState<ThemeDefinition[]>([defaultLightTheme]);
  const [activeTheme, setActiveTheme] = useState<ThemeDefinition>(defaultLightTheme);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async (journalId: string) => {
    const loaded = await db.listEntriesByJournal(journalId);
    setEntries(loaded.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const loadSharedModules = useCallback(async () => {
    setSharedModules(await db.listModuleDefinitions());
  }, []);

  const loadThemes = useCallback(async () => {
    const all = await listAllThemes();
    setThemes(all);
    return all;
  }, []);

  const handleThemeChange = useCallback((theme: ThemeDefinition) => {
    setActiveTheme(theme);
    saveActiveThemeId(theme.id);
    applyThemeToDocument(theme);
  }, []);

  const handleThemesChanged = useCallback(async () => {
    const all = await loadThemes();
    if (!all.some((theme) => theme.id === activeTheme.id)) {
      handleThemeChange(defaultLightTheme);
    }
  }, [loadThemes, activeTheme.id, handleThemeChange]);

  useEffect(() => {
    (async () => {
      await ensureDbInitialized();
      const active = await ensureDefaultJournal(db);
      setJournal(active);
      await loadEntries(active.id);
      await loadSharedModules();

      const allThemes = await loadThemes();
      const persistedId = loadActiveThemeId();
      const persistedTheme = allThemes.find((theme) => theme.id === persistedId) ?? defaultLightTheme;
      setActiveTheme(persistedTheme);
      applyThemeToDocument(persistedTheme);

      // Only matters the very first time a board is ever created -- after
      // that it's a genuinely independent per-board setting (Canvas
      // Settings -> Background), this just avoids a mismatched default.
      const activeBoard = await ensureDefaultBoard(db, persistedTheme.colors.background);
      setBoard(activeBoard);

      setReady(true);
    })();
  }, [loadEntries, loadSharedModules, loadThemes]);

  const handleEntriesChanged = useCallback(() => {
    if (journal) loadEntries(journal.id);
  }, [journal, loadEntries]);

  const handleNetworkStateChange = useCallback((state: NetworkState) => {
    gatekeeper.setState(state);
    setNetworkState(state);
  }, []);

  const handleBoardConfigChange = useCallback(
    async (config: CanvasConfig) => {
      if (!board) return;
      await db.updateBoard(board.id, { canvasConfig: config });
      setBoard((prev) => (prev ? { ...prev, canvasConfig: config } : prev));
    },
    [board],
  );

  const handleSaveEntry = useCallback(
    async (entryId: string, updates: { title: string; content: string }) => {
      const now = Date.now();
      await db.updateEntry(entryId, { ...updates, updatedAt: now });
      setEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, ...updates, updatedAt: now } : entry)),
      );
    },
    [],
  );

  const handleNavigateByTitle = useCallback(
    async (title: string) => {
      const normalized = title.trim().toLowerCase();
      const existing = entries.find((entry) => entry.title.trim().toLowerCase() === normalized);
      if (existing) {
        setViewEntryId(existing.id);
        return;
      }
      if (!journal) return;

      const now = Date.now();
      const created: Entry = {
        id: newId(),
        journalId: journal.id,
        title: title.trim(),
        content: "",
        mood: null,
        energy: null,
        focus: null,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      await db.createEntry(created);
      setEntries((prev) => [created, ...prev]);
      setViewEntryId(created.id);
    },
    [entries, journal],
  );

  const handleExport = useCallback(async () => {
    if (!journal) return;
    await exportJournal(journal, entries);
  }, [journal, entries]);

  // Same merge convention as handleImportFileChange: a pulled journal's id
  // won't match this device's local journal id (each device generates its
  // own on first run, see ensureDefaultJournal), so entries are remapped
  // onto the local journal rather than treated as a second journal.
  const handleSyncPulled = useCallback(
    async (pulled: PulledJournal) => {
      if (!journal) return;
      await db.updateJournal(journal.id, { title: pulled.journal.title, icon: pulled.journal.icon });
      setJournal((prev) => (prev ? { ...prev, title: pulled.journal.title, icon: pulled.journal.icon } : prev));

      const existingIds = new Set(entries.map((entry) => entry.id));
      for (const imported of pulled.entries) {
        const entry: Entry = { ...imported, journalId: journal.id };
        if (existingIds.has(entry.id)) {
          await db.updateEntry(entry.id, entry);
        } else {
          await db.createEntry(entry);
        }
      }
      await loadEntries(journal.id);
    },
    [journal, entries, loadEntries],
  );

  // Native menu items (File > Export/Import) emit these same event names
  // from the Rust side -- see apps/desktop/src-tauri/src/lib.rs. Only
  // relevant on desktop; a plain browser tab never receives them. "New
  // Entry" used to focus the title field directly, back when the entry
  // form always had a fixed spot on the page -- now that journaling is a
  // Journal module that may or may not be on the board, there's no longer
  // a reliable element to focus, so that shortcut's effect is gone with it.
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenFns: Array<() => void> = [];
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlistenFns = await Promise.all([
        listen("export_json", () => handleExport()),
        listen("import_json", () => importInputRef.current?.click()),
      ]);
    })();

    return () => {
      for (const unlisten of unlistenFns) unlisten();
    };
  }, [handleExport]);

  const handleImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !journal) return;

      setImportError(null);
      try {
        const raw = await file.text();
        const parsed = parseJournalExport(raw);

        const existingIds = new Set(entries.map((entry) => entry.id));
        for (const imported of parsed.entries) {
          const entry: Entry = { ...imported, journalId: journal.id };
          if (existingIds.has(entry.id)) {
            await db.updateEntry(entry.id, entry);
          } else {
            await db.createEntry(entry);
          }
        }
        await loadEntries(journal.id);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Import failed.");
      }
    },
    [journal, entries, loadEntries],
  );

  if (!ready || !journal || !board) {
    return <div className="loading">Loading…</div>;
  }

  const viewEntry = viewEntryId ? (entries.find((entry) => entry.id === viewEntryId) ?? null) : null;

  if (viewEntry) {
    return (
      <EntryView
        key={viewEntry.id}
        entry={viewEntry}
        allEntries={entries}
        onBack={() => setViewEntryId(null)}
        onSave={(updates) => handleSaveEntry(viewEntry.id, updates)}
        onNavigate={handleNavigateByTitle}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{journal.title}</h1>
        <div className="header-actions">
          <button type="button" onClick={handleExport}>
            Export JSON
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleImportFileChange}
          />
          <ThemeSwitcher themes={themes} activeThemeId={activeTheme.id} onChange={handleThemeChange} />
          <NetworkToggle state={networkState} onChange={handleNetworkStateChange} />
          <AccountPanel networkState={networkState} journal={journal} entries={entries} onPulled={handleSyncPulled} />
        </div>
      </header>
      {importError && <p className="import-error">{importError}</p>}

      <BoardContextProvider
        value={{
          entries,
          networkState,
          journal,
          onEntriesChanged: handleEntriesChanged,
          onOpenEntry: setViewEntryId,
          sharedModules,
          onSharedModulesChange: loadSharedModules,
          themes,
          activeTheme,
          onThemesChange: handleThemesChanged,
        }}
      >
        <BoardCanvas board={board} onConfigChange={handleBoardConfigChange} />
      </BoardContextProvider>
    </div>
  );
}
