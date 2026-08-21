import type { DataPayload, NetworkState } from "@bulletspace/core";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  clearWeatherConfig,
  fetchCurrentWeather,
  loadWeatherConfig,
  saveWeatherConfig,
  weatherAdapterDefinition,
  type WeatherProvider,
} from "../../adapters/weather";
import { fetchWithCache } from "../../lib/adapterCache";
import { db } from "../../lib/db";
import { useOnlineStatus } from "../../lib/useOnlineStatus";

interface WeatherModuleProps {
  networkState: NetworkState;
}

export function WeatherModule({ networkState }: WeatherModuleProps) {
  const [config, setConfig] = useState(loadWeatherConfig());
  const [providerDraft, setProviderDraft] = useState<WeatherProvider>("openweathermap");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [payload, setPayload] = useState<DataPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const canUseNetwork = networkState !== "local";

  const loadFromCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWithCache(weatherAdapterDefinition, fetchCurrentWeather, (revalidated) => {
        setPayload(revalidated);
        setStale(false);
      });
      setPayload(result.payload);
      setStale(result.isStale);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load weather.");
    } finally {
      setLoading(false);
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchCurrentWeather();
      await db.setCachedAdapterData({
        adapterId: weatherAdapterDefinition.id,
        payload: fresh,
        cachedAt: Date.now(),
      });
      setPayload(fresh);
      setStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load weather.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config && canUseNetwork) loadFromCache();
  }, [config, canUseNetwork, loadFromCache]);

  const handleConnect = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!apiKeyDraft.trim() || !cityDraft.trim()) return;
      const next = { provider: providerDraft, apiKey: apiKeyDraft.trim(), city: cityDraft.trim() };
      saveWeatherConfig(next);
      setConfig(next);
    },
    [providerDraft, apiKeyDraft, cityDraft],
  );

  if (!canUseNetwork) {
    return (
      <div className="module">
        <h3>Weather</h3>
        <p className="empty">Switch to Connected or AI mode to fetch weather.</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="module">
        <h3>Weather</h3>
        <form className="entry-form" onSubmit={handleConnect}>
          <select
            value={providerDraft}
            onChange={(event) => setProviderDraft(event.target.value as WeatherProvider)}
            aria-label="Weather provider"
          >
            <option value="openweathermap">OpenWeatherMap</option>
            <option value="weatherstack">Weatherstack</option>
          </select>
          <input
            value={apiKeyDraft}
            onChange={(event) => setApiKeyDraft(event.target.value)}
            placeholder="API key"
            aria-label="Weather API key"
          />
          <input
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder="City (e.g. London)"
            aria-label="Weather city"
          />
          <button type="submit">Connect</button>
        </form>
      </div>
    );
  }

  const row = payload?.rows[0];

  return (
    <div className="module">
      <div className="module-header">
        <h3>Weather in {config.city}</h3>
        <div className="entry-actions">
          <button type="button" onClick={forceRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearWeatherConfig();
              setConfig(null);
              setPayload(null);
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
      {!online && (
        <p className="offline-banner">
          You're offline — showing cached data{payload ? ` from ${new Date(payload._cachedAt).toLocaleString()}` : ""}.
        </p>
      )}
      {error && <p className="import-error">{error}</p>}
      {row && (
        <p className="weather-summary">
          {String(row.temperature_c)}°C, {String(row.condition)} (humidity {String(row.humidity)}%) —{" "}
          <span className="weather-source">
            via {config.provider}
            {stale && !online ? " (cached, revalidating…)" : ""}
          </span>
        </p>
      )}
    </div>
  );
}
