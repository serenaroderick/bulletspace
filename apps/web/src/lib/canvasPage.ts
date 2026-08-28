import type { CanvasConfig } from "@bulletspace/core";

/**
 * Page-size presets for Phase 6.1's bounded-canvas-per-entry model
 * (Option A: one page per entry). "Freeform" is the default for new
 * entries -- big enough to feel unconstrained day-to-day, while still
 * being a real boundary (not infinite pan).
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

export function defaultCanvasConfig(): CanvasConfig {
  const freeform = pageSizePresets[0];
  return {
    width: freeform.width,
    height: freeform.height,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    grid: { style: "dot", spacing: 24, color: "#dddddd", opacity: 0.7 },
    canvasBackground: { type: "color", value: "#ffffff" },
    parallax: { enabled: true, backgroundSpeed: 0.3, photoSpeed: 0.7 },
    snapToGrid: true,
  };
}
