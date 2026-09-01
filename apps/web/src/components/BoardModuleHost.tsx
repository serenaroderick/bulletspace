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
import { type TrackerChecked, type TrackerColumn, type TrackerRow, TrackerModule } from "./modules/TrackerModule";
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
interface BoardModuleHostProps {
  moduleId: ModuleId;
  /** Only read by the handful of modules with a properties panel (see ModulePropertiesPanel.tsx) -- everything else ignores it. */
  content: Record<string, unknown>;
  onConfigChange: (patch: Record<string, unknown>) => void;
}

export function BoardModuleHost({ moduleId, content, onConfigChange }: BoardModuleHostProps) {
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
      return (
        <HabitStreakModule
          entries={entries}
          daysToShow={typeof content.daysToShow === "number" ? content.daysToShow : undefined}
        />
      );
    case "mood-line":
      return <MoodLineChart entries={entries} />;
    case "energy-focus":
      return <EnergyFocusChart entries={entries} />;
    case "tag-frequency":
      return (
        <TagFrequencyModule entries={entries} limit={typeof content.limit === "number" ? content.limit : undefined} />
      );
    case "mood-vs-weather":
      return (
        <MoodVsWeatherModule
          entries={entries}
          view={content.view === "table" ? "table" : "chart"}
          onViewChange={(view) => onConfigChange({ view })}
        />
      );
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
    case "tracker":
      return (
        <TrackerModule
          columns={Array.isArray(content.columns) ? (content.columns as TrackerColumn[]) : undefined}
          rows={Array.isArray(content.rows) ? (content.rows as TrackerRow[]) : undefined}
          checked={
            content.checked && typeof content.checked === "object" ? (content.checked as TrackerChecked) : undefined
          }
          onConfigChange={onConfigChange}
        />
      );
  }
}
