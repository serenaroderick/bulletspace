import type { ModuleId } from "../modules/registry";
import { useBoardContext } from "./BoardContext";
import { EnergyFocusChart } from "./modules/EnergyFocusChart";
import { GithubModule } from "./modules/GithubModule";
import { GoogleCalendarModule } from "./modules/GoogleCalendarModule";
import { HabitStreakModule } from "./modules/HabitStreakModule";
import { JournalModule } from "./modules/JournalModule";
import { MoodLineChart } from "./modules/MoodLineChart";
import { MoodVsWeatherModule } from "./modules/MoodVsWeatherModule";
import { TagFrequencyModule } from "./modules/TagFrequencyModule";
import { WeatherModule } from "./modules/WeatherModule";
import { SharedModulesPanel } from "./SharedModulesPanel";
import { ThemeSharePanel } from "./ThemeSharePanel";

/**
 * Renders the real module component for a `CanvasElement`'s `moduleId`,
 * pulling whatever props it needs from BoardContext. The module
 * components keep their own existing prop signatures untouched -- this is
 * the one piece of new wiring that lets them live as canvas elements.
 * Journal/SharedModules/ThemeShare joined the original 8 once journaling
 * stopped being a separate page (see App.tsx) -- everything lives on the
 * one board now, nothing is a fixed second view.
 */
export function BoardModuleHost({ moduleId }: { moduleId: ModuleId }) {
  const {
    entries,
    networkState,
    journal,
    onEntriesChanged,
    onOpenEntry,
    sharedModules,
    onSharedModulesChange,
    themes,
    activeTheme,
    onThemesChange,
  } = useBoardContext();

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
    case "journal":
      return (
        <JournalModule journal={journal} entries={entries} onEntriesChanged={onEntriesChanged} onOpenEntry={onOpenEntry} />
      );
    case "shared-modules":
      return (
        <SharedModulesPanel entries={entries} sharedModules={sharedModules} onSharedModulesChange={onSharedModulesChange} />
      );
    case "theme-share":
      return <ThemeSharePanel themes={themes} activeTheme={activeTheme} onThemesChange={onThemesChange} />;
  }
}
