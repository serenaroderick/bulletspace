export interface Journal {
  id: string;
  title: string;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Entry {
  id: string;
  journalId: string;
  title: string;
  content: string;
  canvasConfig: CanvasConfig;
  mood: number | null;
  energy: number | null;
  focus: number | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CanvasConfig {
  gridType: "dot" | "lined" | "blank" | "graph";
  zoom: number;
  scrollX: number;
  scrollY: number;
}

export type CanvasElementType = "text" | "table" | "chart" | "image" | "embed" | "sticker";

export interface CanvasElement {
  id: string;
  entryId: string;
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
}
