import { type Entry, type ModuleDefinition, checkRequiredAdapters, parseModuleShare } from "@bulletspace/core";
import { useCallback, useState } from "react";
import { listKnownAdapters } from "../adapters/registry";
import { db } from "../lib/db";
import { SharedModuleCard } from "./SharedModuleCard";

interface SharedModulesPanelProps {
  entries: Entry[];
  sharedModules: ModuleDefinition[];
  onSharedModulesChange: () => void;
}

export function SharedModulesPanel({ entries, sharedModules, onSharedModulesChange }: SharedModulesPanelProps) {
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    moduleDef: ModuleDefinition;
    availability: Array<{ id: string; name: string; available: boolean }>;
  } | null>(null);

  const handlePreview = useCallback(() => {
    setError(null);
    setPreview(null);
    try {
      const share = parseModuleShare(pasted);
      const knownAdapterIds = listKnownAdapters().map((adapter) => adapter.id);
      const availability = checkRequiredAdapters(share, knownAdapterIds);
      setPreview({ moduleDef: share.module, availability });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse module share JSON.");
    }
  }, [pasted]);

  const handleImport = useCallback(async () => {
    if (!preview) return;
    await db.createModuleDefinition(preview.moduleDef);
    setPasted("");
    setPreview(null);
    onSharedModulesChange();
  }, [preview, onSharedModulesChange]);

  const handleRemove = useCallback(
    async (id: string) => {
      await db.deleteModuleDefinition(id);
      onSharedModulesChange();
    },
    [onSharedModulesChange],
  );

  const allAvailable = preview ? preview.availability.every((a) => a.available) : false;

  return (
    <div className="module shared-modules-panel">
      <h3>Import a shared module</h3>
      <p className="shared-modules-hint">
        Paste a module JSON someone shared with you (via "Share" on a module, e.g. Mood vs. Weather).
      </p>
      <textarea
        className="shared-modules-textarea"
        value={pasted}
        onChange={(event) => setPasted(event.target.value)}
        placeholder="Paste module JSON here…"
        rows={4}
        aria-label="Paste shared module JSON"
      />
      <div className="entry-actions">
        <button type="button" onClick={handlePreview} disabled={!pasted.trim()}>
          Preview
        </button>
        <button type="button" onClick={handleImport} disabled={!preview || !allAvailable}>
          Import
        </button>
      </div>
      {error && <p className="import-error">{error}</p>}
      {preview && (
        <div className="shared-modules-preview">
          <p>
            <strong>{preview.moduleDef.name}</strong> ({preview.moduleDef.type})
          </p>
          <ul>
            {preview.availability.map((a) => (
              <li key={a.id} className={a.available ? "adapter-available" : "adapter-missing"}>
                {a.name}: {a.available ? "available" : "not installed in this build"}
              </li>
            ))}
          </ul>
          {!allAvailable && (
            <p className="empty">
              This module needs an adapter this build doesn't have — can't import it here.
            </p>
          )}
        </div>
      )}

      {sharedModules.map((moduleDef) => (
        <SharedModuleCard
          key={moduleDef.id}
          moduleDef={moduleDef}
          entries={entries}
          onRemove={() => handleRemove(moduleDef.id)}
        />
      ))}
    </div>
  );
}
