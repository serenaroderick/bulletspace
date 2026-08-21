import type { Entry } from "@bulletspace/core";
import { useEffect, useMemo, useState } from "react";
import { findBacklinks } from "../lib/wikilinks";
import { MarkdownView } from "./MarkdownView";

interface EntryViewProps {
  entry: Entry;
  allEntries: Entry[];
  onBack: () => void;
  onSave: (updates: { title: string; content: string }) => void;
  onNavigate: (title: string) => void;
}

export function EntryView({ entry, allEntries, onBack, onSave, onNavigate }: EntryViewProps) {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const backlinks = useMemo(
    () => findBacklinks(allEntries.filter((other) => other.id !== entry.id), entry.title),
    [allEntries, entry.id, entry.title],
  );

  const dirty = title !== entry.title || content !== entry.content;
  const canSave = dirty && title.trim().length > 0;

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  };

  const handleBack = () => {
    if (confirmDiscardIfDirty()) onBack();
  };

  const handleNavigate = (targetTitle: string) => {
    if (confirmDiscardIfDirty()) onNavigate(targetTitle);
  };

  return (
    <div className="entry-view">
      <div className="entry-view-toolbar">
        <button type="button" onClick={handleBack}>
          ← Back
        </button>
        <div className="mode-switch">
          <button
            type="button"
            className={mode === "edit" ? "active" : ""}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            className={mode === "preview" ? "active" : ""}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
        </div>
        <button type="button" disabled={!canSave} onClick={() => onSave({ title: title.trim(), content })}>
          Save
        </button>
      </div>

      <input
        className="entry-view-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="Entry title"
      />

      {mode === "edit" ? (
        <textarea
          className="entry-view-editor"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write in Markdown… use [[Entry Title]] to link other entries"
          aria-label="Entry markdown source"
        />
      ) : (
        <div className="entry-view-preview">
          <MarkdownView content={content} onNavigate={handleNavigate} />
        </div>
      )}

      <div className="entry-view-backlinks">
        <h3>Linked from ({backlinks.length})</h3>
        {backlinks.length === 0 ? (
          <p className="empty">No entries link here yet.</p>
        ) : (
          <ul>
            {backlinks.map((backlink) => (
              <li key={backlink.id}>
                <button type="button" onClick={() => handleNavigate(backlink.title)}>
                  {backlink.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
