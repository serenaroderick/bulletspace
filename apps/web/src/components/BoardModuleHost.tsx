import type { ModuleId } from "../modules/registry";
import { useBoardContext } from "./BoardContext";
import { EnergyFocusChart } from "./modules/EnergyFocusChart";
import { GithubModule } from "./modules/GithubModule";
import { GoogleCalendarModule } from "./modules/GoogleCalendarModule";
import { HabitStreakModule } from "./modules/HabitStreakModule";
import { MoodLineChart } from "./modules/MoodLineChart";
import { MoodVsWeatherModule } from "./modules/MoodVsWeatherModule";
import { TagFrequencyModule } from "./modules/TagFrequencyModule";
import { WeatherModule } from "./modules/WeatherModule";

/**
 * Renders the real module component for a `CanvasElement`'s `moduleId`,
 * pulling whatever props it needs from BoardContext. The 8 module
 * components keep their own existing prop signatures untouched -- this is
 * the one piece of new wiring that lets them live as canvas elements.
 */
export function BoardModuleHost({ moduleId }: { moduleId: ModuleId }) {
  const { entries, networkState } = useBoardContext();

  switch (moduleId) {
    case "habit-streak":
      return <HabitStreakModule entries={entries} />;
    case "mood-line":
      return <MoodLineChart entries={entries} />;
    case "energy-focus":
      return <EnergyFocusChart entries={entries} />;
    case "tag-frequency":
      return <TagFrequencyModule entries={entries} />;
    case "mood-vs-weather":
      return <MoodVsWeatherModule entries={entries} />;
    case "weather":
      return <WeatherModule networkState={networkState} />;
    case "github":
      return <GithubModule networkState={networkState} />;
    case "google-calendar":
      return <GoogleCalendarModule networkState={networkState} />;
  }
}
