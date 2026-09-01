export interface Journal {
  id: string;
  title: string;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * The app's canvas -- a Figma-style board holding `CanvasElement`s
 * (modules, stickers), decoupled from any journal entry. Exactly one
 * exists today (see `ensureDefaultBoard`); the shape supports more than
 * one (Phase 6.2.6, deferred) without another migration.
 */
export interface Board {
  id: string;
  name: string;
  canvasConfig: CanvasConfig;
  createdAt: number;
  updatedAt: number;
}

export interface Entry {
  id: string;
  journalId: string;
  title: string;
  content: string;
  mood: number | null;
  energy: number | null;
  focus: number | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type GridStyle = "dot" | "lined" | "blank" | "graph";

/** Bundled together since the canvas renderer always needs all four to draw a frame. */
export interface GridConfig {
  style: GridStyle;
  /** px between repeats -- dots/lines/cells, depending on style. */
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
  /** Fraction of pan speed the background layer moves at. Default 0.3. */
  backgroundSpeed: number;
  /** Fraction of pan speed the photo layer (behind the grid) moves at. Default 0.7. */
  photoSpeed: number;
}

/**
 * A bounded canvas "page." Originally per-entry (Phase 6.1's Option A);
 * Phase 6.2.5 moved this onto `Board` instead -- one board is the app's
 * single Figma-style canvas, decoupled from any journal entry, so modules
 * and stickers can share the same freeform space. Grid/background/
 * parallax live here, not on ThemeDefinition -- different boards should be
 * able to look different from each other, independent of the app's own
 * color theme.
 */
export interface CanvasConfig {
  /** px. The canvas is bounded, not infinite -- panning stops at the edges. */
  width: number;
  height: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  grid: GridConfig;
  canvasBackground: CanvasBackground;
  parallax: ParallaxConfig;
  /**
   * Phase 6.2: dragged elements snap to `grid.spacing` by default -- the
   * increment users already see, not a second independent number that
   * could drift out of sync with the visible grid. Freeform is a toggle,
   * not the default: alignment reads as "bullet journal," raw pixel
   * positions don't.
   */
  snapToGrid: boolean;
  /**
   * Global drag lock for the whole page. ON: every element is draggable.
   * OFF: nothing moves, so the page's own content (a button inside a
   * module, selecting text) can be interacted with safely. Deliberately
   * simpler than per-element locking -- that's deferred until real usage
   * shows it's actually needed, rather than built speculatively.
   */
  editMode: boolean;
}

export type CanvasElementType = "text" | "table" | "chart" | "image" | "embed" | "sticker" | "module";

export interface CanvasElement {
  id: string;
  boardId: string;
  type: CanvasElementType;
  content: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  /**
   * Added ahead of Phase 6.2's full drag/resize/rotate work, scoped to
   * exactly what Phase 5.5's sticker placement needs. Every element gets
   * these now (not sticker-only) so 6.2 extends this shape rather than
   * migrating it later.
   */
  rotation: number;
  opacity: number;
  /**
   * Elements sharing a non-null groupId move/select together (Cmd+G).
   * Deliberately just a shared id, not a separate "group" entity of its
   * own -- nothing else needs to reference a group independent of its
   * members yet.
   */
  groupId: string | null;
}
