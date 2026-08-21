import type { Entry, Journal, NetworkState } from "@bulletspace/core";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import "./App.css";
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

  if (!ready || !journal) {
    return <div className="loading">Loading…</div>;
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
              <div className="entry-title">{entry.title}</div>
              <pre className="entry-content">{entry.content}</pre>
              <button type="button" onClick={() => handleDeleteEntry(entry.id)}>
                Delete
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="empty">No entries yet.</li>}
        </ul>
      </main>
    </div>
  );
}
