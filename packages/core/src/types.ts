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

export type CanvasElementType = "text" | "table" | "chart" | "image" | "embed";

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
}
