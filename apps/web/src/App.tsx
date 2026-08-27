import type { CanvasConfig, Entry, Journal, ModuleDefinition, NetworkState } from "@bulletspace/core";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { AccountPanel } from "./components/AccountPanel";
import { EntryCanvas } from "./components/EntryCanvas";
import { EntryView } from "./components/EntryView";
import { EnergyFocusChart } from "./components/modules/EnergyFocusChart";
import { GithubModule } from "./components/modules/GithubModule";
import { GoogleCalendarModule } from "./components/modules/GoogleCalendarModule";
import { HabitStreakModule } from "./components/modules/HabitStreakModule";
import { MoodLineChart } from "./components/modules/MoodLineChart";
import { MoodVsWeatherModule } from "./components/modules/MoodVsWeatherModule";
import { TagFrequencyModule } from "./components/modules/TagFrequencyModule";
import { WeatherModule } from "./components/modules/WeatherModule";
import { NetworkToggle } from "./components/NetworkToggle";
import { SharedModulesPanel } from "./components/SharedModulesPanel";
import { db, ensureDbInitialized } from "./lib/db";
import { exportJournal } from "./lib/exportFile";
import { gatekeeper } from "./lib/gatekeeper";
import { parseJournalExport } from "./lib/importExport";
import { ensureDefaultJournal } from "./lib/journal";
import { isTauri } from "./lib/platform";
import { clampRating, parseTags } from "./lib/rating";

function newId(): string {
  return crypto.randomUUID();
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [networkState, setNetworkState] = useState<NetworkState>(gatekeeper.getState());
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftMood, setDraftMood] = useState("");
  const [draftEnergy, setDraftEnergy] = useState("");
  const [draftFocus, setDraftFocus] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [viewEntryId, setViewEntryId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [sharedModules, setSharedModules] = useState<ModuleDefinition[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async (journalId: string) => {
    const loaded = await db.listEntriesByJournal(journalId);
    setEntries(loaded.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const loadSharedModules = useCallback(async () => {
    setSharedModules(await db.listModuleDefinitions());
  }, []);

  useEffect(() => {
    (async () => {
      await ensureDbInitialized();
      const active = await ensureDefaultJournal(db);
      setJournal(active);
      await loadEntries(active.id);
      await loadSharedModules();
      setReady(true);
    })();
  }, [loadEntries, loadSharedModules]);

  const handleCreateEntry = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!journal || !draftTitle.trim()) return;

      const now = Date.now();
      const entry: Entry = {
        id: newId(),
        journalId: journal.id,
        title: draftTitle.trim(),
        content: draftContent,
        canvasConfig: { gridType: "dot", zoom: 1, scrollX: 0, scrollY: 0 },
        mood: clampRating(draftMood),
        energy: clampRating(draftEnergy),
        focus: clampRating(draftFocus),
        tags: parseTags(draftTags),
        createdAt: now,
        updatedAt: now,
      };

      await db.createEntry(entry);
      setDraftTitle("");
      setDraftContent("");
      setDraftMood("");
      setDraftEnergy("");
      setDraftFocus("");
      setDraftTags("");
      await loadEntries(journal.id);
    },
    [journal, draftTitle, draftContent, draftMood, draftEnergy, draftFocus, draftTags, loadEntries],
  );

  const handleDeleteEntry = useCallback(
    async (id: string, title: string) => {
      if (!journal) return;
      if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
      await db.deleteEntry(id);
      await loadEntries(journal.id);
    },
    [journal, loadEntries],
  );

  const handleNetworkStateChange = useCallback((state: NetworkState) => {
    gatekeeper.setState(state);
    setNetworkState(state);
  }, []);

  const handleEntryCanvasConfigChange = useCallback(async (entryId: string, config: CanvasConfig) => {
    await db.updateEntry(entryId, { canvasConfig: config });
    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, canvasConfig: config } : entry)));
  }, []);

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
        canvasConfig: { gridType: "dot", zoom: 1, scrollX: 0, scrollY: 0 },
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

  // Native menu items (File > New Entry / Export / Import) emit these same
  // event names from the Rust side -- see apps/desktop/src-tauri/src/lib.rs.
  // Only relevant on desktop; a plain browser tab never receives them.
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenFns: Array<() => void> = [];
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlistenFns = await Promise.all([
        listen("new_entry", () => titleInputRef.current?.focus()),
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

  if (!ready || !journal) {
    return <div className="loading">Loading…</div>;
  }

  const openEntry = openEntryId ? (entries.find((entry) => entry.id === openEntryId) ?? null) : null;

  if (openEntry) {
    return (
      <EntryCanvas
        entry={openEntry}
        onBack={() => setOpenEntryId(null)}
        onConfigChange={(config) => handleEntryCanvasConfigChange(openEntry.id, config)}
      />
    );
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
          <NetworkToggle state={networkState} onChange={handleNetworkStateChange} />
          <AccountPanel networkState={networkState} />
        </div>
      </header>
      {importError && <p className="import-error">{importError}</p>}

      <main className="app-main">
        <div className="dashboard">
          <HabitStreakModule entries={entries} />
          <MoodLineChart entries={entries} />
          <EnergyFocusChart entries={entries} />
          <TagFrequencyModule entries={entries} />
          <MoodVsWeatherModule entries={entries} />
          <WeatherModule networkState={networkState} />
          {isTauri() && <GithubModule networkState={networkState} />}
          {isTauri() && <GoogleCalendarModule networkState={networkState} />}
          <SharedModulesPanel
            entries={entries}
            sharedModules={sharedModules}
            onSharedModulesChange={loadSharedModules}
          />
        </div>

        <form className="entry-form" onSubmit={handleCreateEntry}>
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Entry title"
            aria-label="Entry title"
          />
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            placeholder="Write in Markdown…"
            rows={4}
            aria-label="Entry content"
          />
          <div className="rating-inputs">
            <input
              value={draftMood}
              onChange={(event) => setDraftMood(event.target.value)}
              placeholder="Mood (1-10)"
              aria-label="Entry mood"
              type="number"
            />
            <input
              value={draftEnergy}
              onChange={(event) => setDraftEnergy(event.target.value)}
              placeholder="Energy (1-10)"
              aria-label="Entry energy"
              type="number"
            />
            <input
              value={draftFocus}
              onChange={(event) => setDraftFocus(event.target.value)}
              placeholder="Focus (1-10)"
              aria-label="Entry focus"
              type="number"
            />
          </div>
          <input
            value={draftTags}
            onChange={(event) => setDraftTags(event.target.value)}
            placeholder="Tags, comma-separated (optional)"
            aria-label="Entry tags"
          />
          <button type="submit">Add entry</button>
        </form>

        <ul className="entry-list">
          {entries.map((entry) => (
            <li key={entry.id} className="entry">
              <button type="button" className="entry-title" onClick={() => setViewEntryId(entry.id)}>
                {entry.title}
              </button>
              <pre className="entry-content">{entry.content}</pre>
              <div className="entry-actions">
                <button type="button" onClick={() => setViewEntryId(entry.id)}>
                  Open
                </button>
                <button type="button" onClick={() => setOpenEntryId(entry.id)}>
                  Open canvas
                </button>
                <button type="button" onClick={() => handleDeleteEntry(entry.id, entry.title)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
          {entries.length === 0 && <li className="empty">No entries yet.</li>}
        </ul>
      </main>
    </div>
  );
}
