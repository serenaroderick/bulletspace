import type { CanvasConfig } from "@bulletspace/core";

/**
 * Size presets for the board's bounded canvas. "Freeform" is the default
 * -- big enough to feel unconstrained day-to-day, while still being a
 * real boundary (not infinite pan).
 */
export interface PageSizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const pageSizePresets: PageSizePreset[] = [
  { id: "freeform", name: "Freeform", width: 4000, height: 4000 },
  { id: "bullet-journal", name: "Bullet Journal Spread", width: 1200, height: 800 },
  { id: "a1", name: "A1", width: 1684, height: 2384 },
  { id: "a2", name: "A2", width: 1191, height: 1684 },
  { id: "a3", name: "A3", width: 842, height: 1191 },
];

/**
 * `backgroundColor` seeds a sensible first impression (matching the active
 * theme when a board is first created) -- the canvas background stays a
 * genuinely independent, per-board setting after that (Canvas Settings ->
 * Background), not something that keeps following theme changes. A
 * physical journal page doesn't recolor itself when you change the app's
 * chrome; this only avoids a jarringly mismatched *default*.
 */
export function defaultCanvasConfig(backgroundColor = "#ffffff"): CanvasConfig {
  const freeform = pageSizePresets[0];
  return {
    width: freeform.width,
    height: freeform.height,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    grid: { style: "dot", spacing: 24, color: "#dddddd", opacity: 0.7 },
    canvasBackground: { type: "color", value: backgroundColor },
    parallax: { enabled: true, backgroundSpeed: 0.3, photoSpeed: 0.7 },
    snapToGrid: true,
    editMode: true,
  };
}
