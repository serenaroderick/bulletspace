import type {
  AssetItem,
  CanvasBackground,
  CanvasConfig,
  CanvasElement,
  Entry,
  GridConfig,
  ParallaxConfig,
  ThemeDefinition,
} from "@bulletspace/core";
import type Konva from "konva";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Layer, Shape, Stage, Text } from "react-konva";
import { db } from "../lib/db";
import { texturePatterns } from "../themes/textures";
import { CanvasSettingsPanel } from "./CanvasSettingsPanel";
import { StickerPicker } from "./StickerPicker";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;
const STICKER_SIZE = 48;
const BACKGROUND_TILE_SIZE = 64;

function newElementId(): string {
  return crypto.randomUUID();
}

function backgroundCss(background: CanvasBackground): CSSProperties {
  switch (background.type) {
    case "color":
      return { backgroundColor: background.value };
    case "gradient":
      return {
        backgroundImage: `linear-gradient(${background.angleDeg}deg, ${background.from}, ${background.to})`,
        backgroundSize: `${BACKGROUND_TILE_SIZE}px ${BACKGROUND_TILE_SIZE}px`,
        backgroundRepeat: "repeat",
      };
    case "texture": {
      const pattern = texturePatterns[background.textureId];
      return pattern
        ? { backgroundImage: pattern.backgroundImage, backgroundSize: pattern.backgroundSize, backgroundRepeat: "repeat" }
        : {};
    }
    case "image":
      return {
        backgroundImage: `url(${background.dataUrl})`,
        backgroundSize: `${BACKGROUND_TILE_SIZE * 4}px`,
        backgroundRepeat: "repeat",
      };
  }
}

interface EntryCanvasProps {
  entry: Entry;
  theme: ThemeDefinition;
  onBack: () => void;
  onConfigChange: (config: CanvasConfig) => void;
  onGridChange: (patch: Partial<GridConfig>) => void;
  onCanvasBackgroundChange: (background: CanvasBackground) => void;
  onParallaxChange: (patch: Partial<ParallaxConfig>) => void;
}

export function EntryCanvas({
  entry,
  theme,
  onBack,
  onConfigChange,
  onGridChange,
  onCanvasBackgroundChange,
  onParallaxChange,
}: EntryCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const photoLayerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Background moves at parallax.backgroundSpeed of the true pan, the
  // (currently empty -- Phase 6.5 places photos here) photo layer at
  // parallax.photoSpeed, and the grid/elements Stage itself at 1x. Both
  // parallax layers are plain CSS-positioned divs behind the Konva Stage,
  // not additional Konva Layers -- getting differential speeds right via
  // Konva's own nested transform composition is easy to get subtly wrong,
  // while background-position/CSS transform are unambiguous. Updated
  // imperatively via refs (not React state) so panning stays smooth.
  const updateParallax = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { parallax } = theme;
    const x = parallax.enabled ? stage.x() * parallax.backgroundSpeed : 0;
    const y = parallax.enabled ? stage.y() * parallax.backgroundSpeed : 0;
    if (backgroundRef.current) backgroundRef.current.style.backgroundPosition = `${x}px ${y}px`;

    const photoX = parallax.enabled ? stage.x() * parallax.photoSpeed : 0;
    const photoY = parallax.enabled ? stage.y() * parallax.photoSpeed : 0;
    if (photoLayerRef.current) photoLayerRef.current.style.transform = `translate(${photoX}px, ${photoY}px)`;
  }, [theme]);

  useEffect(() => {
    updateParallax();
  }, [updateParallax]);

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

  const handleDragMove = useCallback(() => {
    updateParallax();
  }, [updateParallax]);

  const handleDragEnd = useCallback(() => {
    updateParallax();
    persistConfig();
  }, [updateParallax, persistConfig]);

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
      updateParallax();
      persistConfig();
    },
    [persistConfig, updateParallax],
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
        <button type="button" onClick={() => setSettingsOpen((open) => !open)}>
          Canvas Settings
        </button>
      </div>
      {pickerOpen && <StickerPicker onPick={handlePickSticker} onClose={() => setPickerOpen(false)} />}
      {settingsOpen && (
        <CanvasSettingsPanel
          grid={theme.grid}
          canvasBackground={theme.canvasBackground}
          parallax={theme.parallax}
          onGridChange={onGridChange}
          onCanvasBackgroundChange={onCanvasBackgroundChange}
          onParallaxChange={onParallaxChange}
        />
      )}
      <div className="entry-canvas-surface" ref={containerRef}>
        <div ref={backgroundRef} className="entry-canvas-background" style={backgroundCss(theme.canvasBackground)} />
        <div ref={photoLayerRef} className="entry-canvas-photo-layer" />
        {size.width > 0 && size.height > 0 && (
          <Stage
            ref={stageRef}
            className="entry-canvas-stage"
            width={size.width}
            height={size.height}
            draggable
            x={entry.canvasConfig.scrollX}
            y={entry.canvasConfig.scrollY}
            scaleX={entry.canvasConfig.zoom}
            scaleY={entry.canvasConfig.zoom}
            onWheel={handleWheel}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            <Layer listening={false}>
              <Grid stageRef={stageRef} width={size.width} height={size.height} config={theme.grid} />
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

function Grid({
  stageRef,
  width,
  height,
  config,
}: {
  stageRef: React.RefObject<Konva.Stage>;
  width: number;
  height: number;
  config: GridConfig;
}) {
  if (config.style === "blank") return null;

  return (
    <Shape
      listening={false}
      opacity={config.opacity}
      sceneFunc={(ctx, shape) => {
        const stage = stageRef.current;
        const scale = stage?.scaleX() ?? 1;
        const stageX = stage?.x() ?? 0;
        const stageY = stage?.y() ?? 0;
        const spacing = config.spacing;

        const startX = Math.floor(-stageX / scale / spacing) * spacing;
        const endX = startX + width / scale + spacing;
        const startY = Math.floor(-stageY / scale / spacing) * spacing;
        const endY = startY + height / scale + spacing;

        ctx.fillStyle = config.color;
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1 / scale;

        switch (config.style) {
          case "dot": {
            const radius = 1.5;
            ctx.beginPath();
            for (let x = startX; x <= endX; x += spacing) {
              for (let y = startY; y <= endY; y += spacing) {
                ctx.moveTo(x + radius, y);
                ctx.arc(x, y, radius, 0, Math.PI * 2);
              }
            }
            ctx.fill();
            break;
          }
          case "lined": {
            ctx.beginPath();
            for (let y = startY; y <= endY; y += spacing) {
              ctx.moveTo(startX, y);
              ctx.lineTo(endX, y);
            }
            ctx.stroke();
            break;
          }
          case "graph": {
            ctx.beginPath();
            for (let y = startY; y <= endY; y += spacing) {
              ctx.moveTo(startX, y);
              ctx.lineTo(endX, y);
            }
            for (let x = startX; x <= endX; x += spacing) {
              ctx.moveTo(x, startY);
              ctx.lineTo(x, endY);
            }
            ctx.stroke();
            break;
          }
        }
      }}
    />
  );
}
