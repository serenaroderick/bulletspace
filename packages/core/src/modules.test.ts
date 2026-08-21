import { describe, expect, it } from "vitest";
import type {
  AdapterDefinition,
  DataPayload,
  ModuleDefinition,
} from "./modules.js";

describe("module/adapter schema", () => {
  it("constructs a single-source module definition", () => {
    const spotifyAdapter: AdapterDefinition = {
      id: "spotify-v1",
      name: "Spotify Listening History",
      version: "1.0.0",
      authType: "pkce",
      defaultTtlSeconds: 60 * 60 * 24,
      fields: [
        { id: "played_at", name: "Played At", type: "date", description: "" },
        { id: "artist_name", name: "Artist", type: "string", description: "" },
        { id: "duration_ms", name: "Duration", type: "number", description: "" },
      ],
    };

    const listeningTimeModule: ModuleDefinition = {
      id: "listening-time-chart",
      name: "Listening Time",
      version: "1.0.0",
      type: "single",
      sources: [{ adapterId: spotifyAdapter.id, alias: "music" }],
      transformations: [
        { kind: "filter", expression: "music.played_at >= last_30_days" },
        { kind: "sort", field: "music.played_at", direction: "asc" },
      ],
      output: {
        type: "chart",
        config: { chartType: "bar", x: "played_at", y: "duration_ms" },
      },
    };

    expect(listeningTimeModule.sources).toHaveLength(1);
    expect(listeningTimeModule.joinOn).toBeUndefined();
  });

  it("constructs a merge module definition across two sources", () => {
    const moodVsMusic: ModuleDefinition = {
      id: "mood-vs-music",
      name: "Mood vs. Music",
      version: "1.0.0",
      type: "merge",
      sources: [
        { adapterId: "mood-tracker", alias: "mood" },
        { adapterId: "spotify-v1", alias: "music" },
      ],
      joinOn: "date",
      transformations: [],
      output: {
        type: "chart",
        config: { chartType: "scatter", x: "music.minutes_listened", y: "mood.rating" },
      },
    };

    expect(moodVsMusic.sources.map((s) => s.alias)).toEqual(["mood", "music"]);
    expect(moodVsMusic.joinOn).toBe("date");
  });

  it("carries cache metadata alongside adapter data", () => {
    const payload: DataPayload = {
      fields: [{ id: "rating", name: "Rating", type: "number", description: "" }],
      rows: [{ rating: 7 }],
      _cachedAt: new Date(0).toISOString(),
      _source: "mood-tracker",
    };

    expect(payload._source).toBe("mood-tracker");
    expect(payload.rows[0]).toMatchObject({ rating: 7 });
  });
});
