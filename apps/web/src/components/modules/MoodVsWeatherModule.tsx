import { type DataPayload, type Entry, type ModuleDefinition, type ModuleOutput, runQueryPipeline, serializeModuleShare } from "@bulletspace/core";
import { useCallback, useEffect, useState } from "react";
import { listKnownAdapters } from "../../adapters/registry";
import { entriesToDataPayload, journalAdapterDefinition } from "../../adapters/journal";
import { weatherAdapterDefinition } from "../../adapters/weather";
import { getCachedPayload } from "../../lib/adapterCache";
import { ModuleOutputRenderer } from "../ModuleOutputRenderer";

const CHART_OUTPUT: ModuleOutput = {
  type: "chart",
  config: { chartType: "scatter", x: "weather.temperature_c", y: "mood.rating" },
};

const TABLE_OUTPUT: ModuleOutput = { type: "table", config: {} };

export const MOOD_VS_WEATHER_MODULE_DEF: ModuleDefinition = {
  id: "mood-vs-weather",
  name: "Mood vs. Weather",
  version: "1.0.0",
  type: "merge",
  sources: [
    { adapterId: journalAdapterDefinition.id, alias: "mood" },
    { adapterId: weatherAdapterDefinition.id, alias: "weather" },
  ],
  joinOn: "date",
  transformations: [{ kind: "sort", field: "date", direction: "asc" }],
  output: CHART_OUTPUT,
};

const MODULE_DEF = MOOD_VS_WEATHER_MODULE_DEF;

interface MoodVsWeatherModuleProps {
  entries: Entry[];
}

export function MoodVsWeatherModule({ entries }: MoodVsWeatherModuleProps) {
  const [payload, setPayload] = useState<DataPayload | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const share = serializeModuleShare(MODULE_DEF, listKnownAdapters());
    await navigator.clipboard.writeText(JSON.stringify(share, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const load = useCallback(async () => {
    const weatherPayload = await getCachedPayload(weatherAdapterDefinition.id);
    if (!weatherPayload) {
      setPayload(null);
      return;
    }

    const moodPayload = entriesToDataPayload(entries);
    const result = runQueryPipeline(MODULE_DEF, [
      { alias: "mood", payload: moodPayload },
      { alias: "weather", payload: weatherPayload },
    ]);
    setPayload(result);
  }, [entries]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="module">
      <div className="module-header">
        <h3>Mood vs. Weather</h3>
        <div className="entry-actions">
          <div className="mode-switch">
            <button
              type="button"
              className={view === "chart" ? "active" : ""}
              onClick={() => setView("chart")}
            >
              Chart
            </button>
            <button
              type="button"
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
          <button type="button" onClick={load}>
            Refresh
          </button>
          <button type="button" onClick={handleShare}>
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </div>
      {payload === null && (
        <p className="empty">Connect the Weather module below to see this correlation.</p>
      )}
      {payload !== null && payload.rows.length === 0 && (
        <p className="empty">
          No overlapping days yet between journal entries and cached weather data.
        </p>
      )}
      {payload !== null && payload.rows.length > 0 && (
        <ModuleOutputRenderer output={view === "chart" ? CHART_OUTPUT : TABLE_OUTPUT} payload={payload} />
      )}
    </div>
  );
}
