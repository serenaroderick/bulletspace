import type { ThemeDefinition } from "@bulletspace/core";

/**
 * Built-in themes ship in code, not the database -- only imported/custom
 * themes (Phase 5.5's manual sharing) get persisted via
 * DatabaseAdapter.createThemeDefinition. Mirrors how apps/web/src/adapters
 * ships first-party Adapters separately from imported ModuleDefinitions.
 */
export const defaultLightTheme: ThemeDefinition = {
  id: "default-light",
  name: "Default Light",
  version: "1.0.0",
  colors: {
    background: "#ffffff",
    surface: "#f7f7f8",
    text: "#1a1a1a",
    textMuted: "#666666",
    accent: "#4f7cff",
    border: "#dddddd",
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  spacingUnit: 8,
  cornerRadius: 8,
  lineThickness: 1,
  gridStyle: "dot",
  canvasBackground: { type: "color", value: "#ffffff" },
};

export const midnightTheme: ThemeDefinition = {
  id: "midnight",
  name: "Midnight",
  version: "1.0.0",
  colors: {
    background: "#12141c",
    surface: "#1c1f2b",
    text: "#e8e8ec",
    textMuted: "#9a9aa8",
    accent: "#7c9fff",
    border: "#33374a",
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  spacingUnit: 8,
  cornerRadius: 8,
  lineThickness: 1,
  gridStyle: "dot",
  canvasBackground: { type: "color", value: "#12141c" },
};

export const sepiaTheme: ThemeDefinition = {
  id: "sepia",
  name: "Sepia",
  version: "1.0.0",
  colors: {
    background: "#f4ecd8",
    surface: "#fffaf0",
    text: "#3b2f2f",
    textMuted: "#7a6a58",
    accent: "#a0522d",
    border: "#d8c9a8",
  },
  fontFamily: 'Georgia, "Times New Roman", serif',
  spacingUnit: 8,
  cornerRadius: 4,
  lineThickness: 1,
  gridStyle: "dot",
  canvasBackground: { type: "color", value: "#f4ecd8" },
};

export const builtInThemes: ThemeDefinition[] = [defaultLightTheme, midnightTheme, sepiaTheme];
