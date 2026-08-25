import type { DataPayload, NetworkState } from "@bulletspace/core";
import { useCallback, useEffect, useState } from "react";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fetchCalendarEvents,
  isGoogleCalendarConnected,
} from "../../adapters/googleCalendar";

interface GoogleCalendarModuleProps {
  networkState: NetworkState;
}

export function GoogleCalendarModule({ networkState }: GoogleCalendarModuleProps) {
  const [connected, setConnected] = useState(isGoogleCalendarConnected());
  const [payload, setPayload] = useState<DataPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseNetwork = networkState !== "local";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayload(await fetchCalendarEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && canUseNetwork) refresh();
  }, [connected, canUseNetwork, refresh]);

  const handleConnect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await connectGoogleCalendar();
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Google Calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  if (!canUseNetwork) {
    return (
      <div className="module">
        <h3>Google Calendar</h3>
        <p className="empty">Switch to Connected or AI mode to connect Google Calendar.</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="module">
        <h3>Google Calendar</h3>
        <button type="button" onClick={handleConnect} disabled={loading}>
          {loading ? "Opening browser…" : "Connect Google Calendar"}
        </button>
        {error && <p className="import-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="module">
      <div className="module-header">
        <h3>Calendar Events (±7 days)</h3>
        <div className="entry-actions">
          <button type="button" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              disconnectGoogleCalendar();
              setConnected(false);
              setPayload(null);
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
      {error && <p className="import-error">{error}</p>}
      {payload && payload.rows.length > 0 && (
        <ul className="data-row-list">
          {payload.rows.map((row, i) => (
            <li key={`${String(row.date)}-${i}`}>
              <strong>{String(row.summary)}</strong> — {new Date(String(row.date)).toLocaleString()} (
              {String(row.duration_minutes)} min)
            </li>
          ))}
        </ul>
      )}
      {payload && payload.rows.length === 0 && (
        <p className="empty">No events in the last/next 7 days.</p>
      )}
    </div>
  );
}
