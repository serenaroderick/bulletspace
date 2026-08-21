import type { CanvasConfig, Entry, Journal, NetworkState } from "@bulletspace/core";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import "./App.css";
import { EntryCanvas } from "./components/EntryCanvas";
import { EntryView } from "./components/EntryView";
import { NetworkToggle } from "./components/NetworkToggle";
import { db, ensureDbInitialized } from "./lib/db";
import { gatekeeper } from "./lib/gatekeeper";

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
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [viewEntryId, setViewEntryId] = useState<string | null>(null);

  const loadEntries = useCallback(async (journalId: string) => {
    const loaded = await db.listEntriesByJournal(journalId);
    setEntries(loaded.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    (async () => {
      await ensureDbInitialized();

      const journals = await db.listJournals();
      let active = journals[0];
      if (!active) {
        const now = Date.now();
        active = { id: newId(), title: "My Journal", icon: null, createdAt: now, updatedAt: now };
        await db.createJournal(active);
      }

      setJournal(active);
      await loadEntries(active.id);
      setReady(true);
    })();
  }, [loadEntries]);

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
        mood: null,
        energy: null,
        focus: null,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

      await db.createEntry(entry);
      setDraftTitle("");
      setDraftContent("");
      await loadEntries(journal.id);
    },
    [journal, draftTitle, draftContent, loadEntries],
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      if (!journal) return;
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
        <NetworkToggle state={networkState} onChange={handleNetworkStateChange} />
      </header>

      <main className="app-main">
        <form className="entry-form" onSubmit={handleCreateEntry}>
          <input
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
                <button type="button" onClick={() => handleDeleteEntry(entry.id)}>
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
