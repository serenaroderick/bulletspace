import type { DataPayload, NetworkState } from "@bulletspace/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type DeviceAuthStart,
  disconnectGithub,
  fetchGithubActivity,
  isGithubConnected,
  pollGithubDeviceAuth,
  startGithubDeviceAuth,
} from "../../adapters/github";

interface GithubModuleProps {
  networkState: NetworkState;
}

export function GithubModule({ networkState }: GithubModuleProps) {
  const [connected, setConnected] = useState(isGithubConnected());
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthStart | null>(null);
  const [payload, setPayload] = useState<DataPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const canUseNetwork = networkState !== "local";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayload(await fetchGithubActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load GitHub activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && canUseNetwork) refresh();
  }, [connected, canUseNetwork, refresh]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  const startConnect = useCallback(async () => {
    setError(null);
    try {
      const auth = await startGithubDeviceAuth();
      setDeviceAuth(auth);

      pollTimer.current = window.setInterval(async () => {
        if (Date.now() > auth.expiresAt) {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          setDeviceAuth(null);
          setError("Device code expired. Try connecting again.");
          return;
        }

        const result = await pollGithubDeviceAuth(auth.deviceCode);
        if (result.status === "authorized") {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          setDeviceAuth(null);
          setConnected(true);
        } else if (result.status === "error") {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          setDeviceAuth(null);
          setError(result.error);
        }
      }, auth.interval * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start GitHub device auth.");
    }
  }, []);

  if (!canUseNetwork) {
    return (
      <div className="module">
        <h3>GitHub</h3>
        <p className="empty">Switch to Connected or AI mode to connect GitHub.</p>
      </div>
    );
  }

  if (deviceAuth) {
    return (
      <div className="module">
        <h3>GitHub</h3>
        <p>
          Go to{" "}
          <a href={deviceAuth.verificationUri} target="_blank" rel="noreferrer">
            {deviceAuth.verificationUri}
          </a>{" "}
          and enter this code:
        </p>
        <p className="device-code">{deviceAuth.userCode}</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="module">
        <h3>GitHub</h3>
        <button type="button" onClick={startConnect}>
          Connect GitHub
        </button>
        {error && <p className="import-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="module">
      <div className="module-header">
        <h3>Recent GitHub activity</h3>
        <div className="entry-actions">
          <button type="button" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              disconnectGithub();
              setConnected(false);
              setPayload(null);
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
      {error && <p className="import-error">{error}</p>}
      {payload && (
        <ul className="data-row-list">
          {payload.rows.map((row, i) => (
            <li key={`${String(row.occurred_at)}-${i}`}>
              <strong>{String(row.type)}</strong> on {String(row.repo_name)}
            </li>
          ))}
        </ul>
      )}
      {payload && payload.rows.length === 0 && <p className="empty">No recent public activity.</p>}
    </div>
  );
}
