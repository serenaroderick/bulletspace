import type { AssetItem, CanvasConfig, CanvasElement, Entry } from "@bulletspace/core";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layer, Shape, Stage, Text } from "react-konva";
import { db } from "../lib/db";
import { StickerPicker } from "./StickerPicker";

const GRID_SPACING = 24;
const DOT_RADIUS = 1.5;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;
const STICKER_SIZE = 48;

function newElementId(): string {
  return crypto.randomUUID();
}

interface EntryCanvasProps {
  entry: Entry;
  onBack: () => void;
  onConfigChange: (config: CanvasConfig) => void;
}

export function EntryCanvas({ entry, onBack, onConfigChange }: EntryCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((observed) => {
      const { width, height } = observed[0].contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    db.listCanvasElementsByEntry(entry.id).then(setElements);
  }, [entry.id]);

  const handlePickSticker = useCallback(
    async (sticker: AssetItem) => {
      const stage = stageRef.current;
      const scale = stage?.scaleX() ?? 1;
      const stageX = stage?.x() ?? 0;
      const stageY = stage?.y() ?? 0;
      const centerX = (size.width / 2 - stageX) / scale - STICKER_SIZE / 2;
      const centerY = (size.height / 2 - stageY) / scale - STICKER_SIZE / 2;

      const element: CanvasElement = {
        id: newElementId(),
        entryId: entry.id,
        type: "sticker",
        content: { src: sticker.src },
        x: centerX,
        y: centerY,
        width: STICKER_SIZE,
        height: STICKER_SIZE,
        zIndex: elements.length,
        rotation: 0,
        opacity: 1,
      };

      await db.createCanvasElement(element);
      setElements((prev) => [...prev, element]);
      setPickerOpen(false);
    },
    [entry.id, elements.length, size.width, size.height],
  );

  const persistConfig = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    onConfigChange({
      gridType: entry.canvasConfig.gridType,
      zoom: stage.scaleX(),
      scrollX: stage.x(),
      scrollY: stage.y(),
    });
  }, [entry.canvasConfig.gridType, onConfigChange]);

  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = stage.scaleX();
      const zoomingIn = event.evt.deltaY < 0;
      const newScale = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, zoomingIn ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP),
      );

      const pointInWorld = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position({
        x: pointer.x - pointInWorld.x * newScale,
        y: pointer.y - pointInWorld.y * newScale,
      });
      stage.batchDraw();
      persistConfig();
    },
    [persistConfig],
  );

  return (
    <div className="entry-canvas">
      <div className="entry-canvas-toolbar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <span>{entry.title}</span>
        <button type="button" onClick={() => setPickerOpen((open) => !open)}>
          Add Sticker
        </button>
      </div>
      {pickerOpen && <StickerPicker onPick={handlePickSticker} onClose={() => setPickerOpen(false)} />}
      <div className="entry-canvas-surface" ref={containerRef}>
        {size.width > 0 && size.height > 0 && (
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            draggable
            x={entry.canvasConfig.scrollX}
            y={entry.canvasConfig.scrollY}
            scaleX={entry.canvasConfig.zoom}
            scaleY={entry.canvasConfig.zoom}
            onWheel={handleWheel}
            onDragEnd={persistConfig}
          >
            <Layer listening={false}>
              <DotGrid stageRef={stageRef} width={size.width} height={size.height} />
            </Layer>
            <Layer listening={false}>
              {elements.map((element) =>
                element.type === "sticker" ? (
                  <Text
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    width={element.width}
                    height={element.height}
                    text={typeof element.content.src === "string" ? element.content.src : ""}
                    fontSize={element.height}
                    rotation={element.rotation}
                    opacity={element.opacity}
                    align="center"
                    verticalAlign="middle"
                  />
                ) : null,
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}

function DotGrid({
  stageRef,
  width,
  height,
}: {
  stageRef: React.RefObject<Konva.Stage>;
  width: number;
  height: number;
}) {
  return (
    <Shape
      listening={false}
      fill="#8886"
      sceneFunc={(ctx, shape) => {
        const stage = stageRef.current;
        const scale = stage?.scaleX() ?? 1;
        const stageX = stage?.x() ?? 0;
        const stageY = stage?.y() ?? 0;

        const startX = Math.floor(-stageX / scale / GRID_SPACING) * GRID_SPACING;
        const endX = startX + width / scale + GRID_SPACING;
        const startY = Math.floor(-stageY / scale / GRID_SPACING) * GRID_SPACING;
        const endY = startY + height / scale + GRID_SPACING;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += GRID_SPACING) {
          for (let y = startY; y <= endY; y += GRID_SPACING) {
            ctx.moveTo(x + DOT_RADIUS, y);
            ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
          }
        }
        ctx.fillStrokeShape(shape);
      }}
    />
  );
}
