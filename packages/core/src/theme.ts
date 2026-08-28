export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}

export type ThemeGridStyle = "dot" | "lined" | "blank" | "graph";

/** Bundled together since the Phase 5.6 grid renderer always needs all four to draw a frame. */
export interface GridConfig {
  style: ThemeGridStyle;
  /** px between repeats -- dots/lines/cells/rings, depending on style. */
  spacing: number;
  color: string;
  /** 0-1. */
  opacity: number;
}

export type CanvasBackground =
  | { type: "color"; value: string }
  | { type: "gradient"; from: string; to: string; angleDeg: number }
  | { type: "texture"; textureId: string }
  | { type: "image"; dataUrl: string };

export interface ParallaxConfig {
  enabled: boolean;
  /** Fraction of pan speed the background layer moves at. Default 0.3 per Phase 5.6. */
  backgroundSpeed: number;
  /** Fraction of pan speed the photo layer (z-index 3, behind the grid) moves at. Default 0.7. */
  photoSpeed: number;
}

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
  grid: GridConfig;
  canvasBackground: CanvasBackground;
  parallax: ParallaxConfig;
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
