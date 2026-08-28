export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}

/**
 * Reuses the same shape ideas as Phase 5.6's grid work will need, but that
 * phase renders the actual styles (isometric, hex, circular, etc.) --
 * today only "dot" draws differently on the canvas. A theme carries this
 * as a preference either way, per Phase 5.5's own schema requirement.
 */
export type ThemeGridStyle = "dot" | "lined" | "blank" | "graph";

export type CanvasBackground =
  | { type: "color"; value: string }
  | { type: "gradient"; from: string; to: string; angleDeg: number }
  | { type: "texture"; textureId: string };

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
  gridStyle: ThemeGridStyle;
  canvasBackground: CanvasBackground;
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
