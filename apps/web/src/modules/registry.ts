/**
 * The 8 dashboard modules, addressable by id so a `CanvasElement` of
 * `type: "module"` can say which one it is (`content.moduleId`). The
 * module components themselves keep their existing prop signatures --
 * see BoardModuleHost.tsx for how each one actually gets rendered.
 */
export type ModuleId =
  | "habit-streak"
  | "mood-line"
  | "energy-focus"
  | "tag-frequency"
  | "mood-vs-weather"
  | "weather"
  | "github"
  | "google-calendar"
  | "journal"
  | "shared-modules"
  | "theme-share"
  | "tracker"
  | "custom";

export interface ModuleRegistryEntry {
  id: ModuleId;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  /** Github/Google Calendar need Tauri's native HTTP client -- CORS-blocked on web, same gating App.tsx already applied. */
  requiresTauri?: boolean;
}

export const MODULE_REGISTRY: Record<ModuleId, ModuleRegistryEntry> = {
  "habit-streak": { id: "habit-streak", label: "Habit Streak", defaultWidth: 320, defaultHeight: 200 },
  "mood-line": { id: "mood-line", label: "Mood Over Time", defaultWidth: 420, defaultHeight: 260 },
  "energy-focus": { id: "energy-focus", label: "Energy & Focus", defaultWidth: 420, defaultHeight: 260 },
  "tag-frequency": { id: "tag-frequency", label: "Tag Frequency", defaultWidth: 420, defaultHeight: 260 },
  "mood-vs-weather": { id: "mood-vs-weather", label: "Mood vs. Weather", defaultWidth: 480, defaultHeight: 340 },
  weather: { id: "weather", label: "Weather", defaultWidth: 320, defaultHeight: 280 },
  github: { id: "github", label: "GitHub Activity", defaultWidth: 360, defaultHeight: 320, requiresTauri: true },
  "google-calendar": {
    id: "google-calendar",
    label: "Google Calendar",
    defaultWidth: 360,
    defaultHeight: 320,
    requiresTauri: true,
  },
  journal: { id: "journal", label: "Journal", defaultWidth: 420, defaultHeight: 480 },
  "shared-modules": { id: "shared-modules", label: "Import a Shared Module", defaultWidth: 380, defaultHeight: 320 },
  "theme-share": { id: "theme-share", label: "Themes", defaultWidth: 380, defaultHeight: 320 },
  tracker: { id: "tracker", label: "Tracker", defaultWidth: 420, defaultHeight: 320 },
  custom: { id: "custom", label: "Custom Module", defaultWidth: 420, defaultHeight: 320 },
};

export const MODULE_REGISTRY_LIST: ModuleRegistryEntry[] = Object.values(MODULE_REGISTRY);

/**
 * Phase 6.3 ("light config" scope): only modules with a real, already-
 * existing hardcoded constant worth exposing get a properties panel --
 * not invented settings. Everything else has nothing to configure, so
 * selecting it shows no panel at all.
 */
export const CONFIGURABLE_MODULE_IDS: ReadonlySet<ModuleId> = new Set([
  "habit-streak",
  "tag-frequency",
  "mood-vs-weather",
]);
