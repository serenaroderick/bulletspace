import type { CanvasConfig, Entry } from "@bulletspace/core";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layer, Shape, Stage } from "react-konva";

const GRID_SPACING = 24;
const DOT_RADIUS = 1.5;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;

interface EntryCanvasProps {
  entry: Entry;
  onBack: () => void;
  onConfigChange: (config: CanvasConfig) => void;
}

export function EntryCanvas({ entry, onBack, onConfigChange }: EntryCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

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
      </div>
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
