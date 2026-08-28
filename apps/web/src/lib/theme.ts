import type { ThemeDefinition } from "@bulletspace/core";
import { builtInThemes, defaultLightTheme } from "../themes/registry";
import { db } from "./db";

const ACTIVE_THEME_STORAGE_KEY = "bulletspace.theme.activeId";

export function loadActiveThemeId(): string {
  return localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) ?? defaultLightTheme.id;
}

export function saveActiveThemeId(id: string): void {
  localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, id);
}

/** Built-in themes plus whatever's been imported (Phase 5.5 manual sharing). */
export async function listAllThemes(): Promise<ThemeDefinition[]> {
  const installed = await db.listThemeDefinitions();
  return [...builtInThemes, ...installed];
}

export async function findTheme(id: string): Promise<ThemeDefinition | undefined> {
  const all = await listAllThemes();
  return all.find((theme) => theme.id === id);
}

/**
 * Applies a theme's colors/fonts/spacing/corner-radii/line-thickness as
 * CSS custom properties on the document root -- App.css and index.css
 * consume these instead of hardcoded values, so switching themes takes
 * effect everywhere at once with no reload.
 */
export function applyThemeToDocument(theme: ThemeDefinition): void {
  const root = document.documentElement.style;

  root.setProperty("--bs-color-background", theme.colors.background);
  root.setProperty("--bs-color-surface", theme.colors.surface);
  root.setProperty("--bs-color-text", theme.colors.text);
  root.setProperty("--bs-color-text-muted", theme.colors.textMuted);
  root.setProperty("--bs-color-accent", theme.colors.accent);
  root.setProperty("--bs-color-border", theme.colors.border);
  root.setProperty("--bs-font-family", theme.fontFamily);
  root.setProperty("--bs-spacing-unit", `${theme.spacingUnit}px`);
  root.setProperty("--bs-corner-radius", `${theme.cornerRadius}px`);
  root.setProperty("--bs-line-thickness", `${theme.lineThickness}px`);

  const background = theme.canvasBackground;
  if (background.type === "color") {
    root.setProperty("--bs-canvas-background", background.value);
  } else if (background.type === "gradient") {
    root.setProperty(
      "--bs-canvas-background",
      `linear-gradient(${background.angleDeg}deg, ${background.from}, ${background.to})`,
    );
  } else {
    // "texture" has no asset pipeline yet (Phase 5.6 scope) -- fall back
    // to the theme's own background color rather than leaving a stale var.
    root.setProperty("--bs-canvas-background", theme.colors.background);
  }
}
