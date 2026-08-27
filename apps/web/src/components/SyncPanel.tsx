import type { Entry, Journal } from "@bulletspace/core";
import { useState } from "react";
import { type PulledJournal, pullJournal, pushJournal } from "../lib/sync";

interface SyncPanelProps {
  journal: Journal;
  entries: Entry[];
  onPulled: (pulled: PulledJournal) => Promise<void>;
}

export function SyncPanel({ journal, entries, onPulled }: SyncPanelProps) {
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePush = async () => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      await pushJournal(journal, entries, passphrase);
      setStatus("Pushed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed.");
    } finally {
      setBusy(false);
    }
  };

  const handlePull = async () => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const pulled = await pullJournal(passphrase);
      if (!pulled) {
        setStatus("Nothing synced yet.");
        return;
      }
      await onPulled(pulled);
      setStatus(`Pulled ${pulled.entries.length} entries.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pull failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sync-panel">
      <input
        type="password"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        placeholder="Sync passphrase"
        aria-label="Sync passphrase"
        minLength={1}
      />
      <button type="button" onClick={handlePush} disabled={busy || !passphrase}>
        Push
      </button>
      <button type="button" onClick={handlePull} disabled={busy || !passphrase}>
        Pull
      </button>
      {status && <span className="sync-status">{status}</span>}
      {error && <span className="import-error">{error}</span>}
    </div>
  );
}
