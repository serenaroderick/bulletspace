import { type Entry, type ModuleDefinition, runQueryPipeline } from "@bulletspace/core";
import { useCallback, useEffect, useState } from "react";
import { entriesToDataPayload, journalAdapterDefinition } from "../../adapters/journal";
import { weatherAdapterDefinition } from "../../adapters/weather";
import { getCachedPayload } from "../../lib/adapterCache";

const MODULE_DEF: ModuleDefinition = {
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
  output: { type: "table", config: {} },
};

interface MoodVsWeatherModuleProps {
  entries: Entry[];
}

export function MoodVsWeatherModule({ entries }: MoodVsWeatherModuleProps) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);

  const load = useCallback(async () => {
    const weatherPayload = await getCachedPayload(weatherAdapterDefinition.id);
    if (!weatherPayload) {
      setRows(null);
      return;
    }

    const moodPayload = entriesToDataPayload(entries);
    const result = runQueryPipeline(MODULE_DEF, [
      { alias: "mood", payload: moodPayload },
      { alias: "weather", payload: weatherPayload },
    ]);
    setRows(result.rows);
  }, [entries]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="module">
      <div className="module-header">
        <h3>Mood vs. Weather</h3>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      {rows === null && (
        <p className="empty">Connect the Weather module below to see this correlation.</p>
      )}
      {rows !== null && rows.length === 0 && (
        <p className="empty">
          No overlapping days yet between journal entries and cached weather data.
        </p>
      )}
      {rows !== null && rows.length > 0 && (
        <table className="merge-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Mood</th>
              <th>Temp (°C)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.date)}>
                <td>{String(row.date)}</td>
                <td>{String(row["mood.rating"])}</td>
                <td>{String(row["weather.temperature_c"])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
