export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}

/**
 * Grid/canvas-background/parallax deliberately do NOT live here --
 * Phase 6.1's per-entry bounded canvas pages own those (see
 * CanvasConfig in types.ts), so different pages can look different from
 * each other independent of the app's color theme. Theme stays UI-chrome
 * styling: colors, fonts, spacing, corner radii, line thickness.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  version: string;
  colors: ThemeColors;
  fontFamily: string;
  /** Base spacing unit in px that the UI's paddings/gaps scale from. */
  spacingUnit: number;
  cornerRadius: number;
  lineThickness: number;
}

export type AssetKind = "sticker" | "icon" | "font";

export interface AssetItem {
  id: string;
  name: string;
  kind: AssetKind;
  /**
   * A data URL, an emoji literal, or a same-origin file reference.
   * Asset packs transmit media, never executable content -- unlike
   * Adapters, which are why those only ever travel as an id/name/version
   * manifest (see moduleShare.ts). Media carries no equivalent risk, so
   * asset packs travel as real content, same as Modules.
   */
  src: string;
}

export interface AssetDefinition {
  id: string;
  name: string;
  version: string;
  items: AssetItem[];
}
