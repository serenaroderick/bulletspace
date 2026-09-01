import type { Entry, Journal } from "@bulletspace/core";
import { type FormEvent, useState } from "react";
import { db } from "../../lib/db";
import { clampRating, parseTags } from "../../lib/rating";

function newId(): string {
  return crypto.randomUUID();
}

interface JournalModuleProps {
  journal: Journal;
  entries: Entry[];
  onEntriesChanged: () => void;
  onOpenEntry: (entryId: string) => void;
}

/**
 * The entry-creation form + entry list, self-contained the same way
 * WeatherModule/GithubModule own their own state/effects -- moved here
 * from App.tsx (Phase 6.2.5 follow-up) so journaling is a board module
 * like everything else, not a fixed second page bolted on next to the
 * canvas.
 */
export function JournalModule({ journal, entries, onEntriesChanged, onOpenEntry }: JournalModuleProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftMood, setDraftMood] = useState("");
  const [draftEnergy, setDraftEnergy] = useState("");
  const [draftFocus, setDraftFocus] = useState("");
  const [draftTags, setDraftTags] = useState("");

  const handleCreateEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!draftTitle.trim()) return;

    const now = Date.now();
    const entry: Entry = {
      id: newId(),
      journalId: journal.id,
      title: draftTitle.trim(),
      content: draftContent,
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
    onEntriesChanged();
  };

  const handleDeleteEntry = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    await db.deleteEntry(id);
    onEntriesChanged();
  };

  return (
    <div className="module">
      <h3>Journal</h3>
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
            <button type="button" className="entry-title" onClick={() => onOpenEntry(entry.id)}>
              {entry.title}
            </button>
            <pre className="entry-content">{entry.content}</pre>
            <div className="entry-actions">
              <button type="button" onClick={() => onOpenEntry(entry.id)}>
                Open
              </button>
              <button type="button" onClick={() => handleDeleteEntry(entry.id, entry.title)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {entries.length === 0 && <li className="empty">No entries yet.</li>}
      </ul>
    </div>
  );
}
