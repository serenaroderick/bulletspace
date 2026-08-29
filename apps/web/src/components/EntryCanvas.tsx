import type { AssetItem, CanvasBackground, CanvasConfig, CanvasElement, Entry, GridConfig, ParallaxConfig } from "@bulletspace/core";
import type Konva from "konva";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Shape, Stage, Text, Transformer } from "react-konva";
import { db } from "../lib/db";
import { texturePatterns } from "../themes/textures";
import { CanvasSettingsPanel } from "./CanvasSettingsPanel";
import { StickerPicker } from "./StickerPicker";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;
const STICKER_SIZE = 48;
const MIN_ELEMENT_SIZE = 16;
const BACKGROUND_TILE_SIZE = 64;
const VOID_COLOR = "#d9d9dc";

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

function clampStagePosition(
  pos: { x: number; y: number },
  scale: number,
  pageWidth: number,
  pageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const scaledWidth = pageWidth * scale;
  const scaledHeight = pageHeight * scale;
  const minX = Math.min(0, viewportWidth - scaledWidth);
  const maxX = Math.max(0, viewportWidth - scaledWidth);
  const minY = Math.min(0, viewportHeight - scaledHeight);
  const maxY = Math.max(0, viewportHeight - scaledHeight);
  return {
    x: Math.min(maxX, Math.max(minX, pos.x)),
    y: Math.min(maxY, Math.max(minY, pos.y)),
  };
}

interface EntryCanvasProps {
  entry: Entry;
  pageIndex: number;
  pageCount: number;
  previousEntryId: string | null;
  nextEntryId: string | null;
  onBack: () => void;
  onConfigChange: (config: CanvasConfig) => void;
  onNavigate: (entryId: string) => void;
  onNewPage: () => void;
  onDuplicatePage: () => void;
}

export function EntryCanvas({
  entry,
  pageIndex,
  pageCount,
  previousEntryId,
  nextEntryId,
  onBack,
  onConfigChange,
  onNavigate,
  onNewPage,
  onDuplicatePage,
}: EntryCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const photoLayerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const elementNodeRefs = useRef<Record<string, Konva.Group>>({});
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const { canvasConfig } = entry;

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

  // The background div is clipped to the page's on-screen projection (so
  // it never shows past the bounded page's edges -- the void around it is
  // a plain color), while its background-position keeps shifting at
  // parallax.backgroundSpeed of the true pan. That gives "the pattern
  // subtly shifts as you pan" depth *within* a fixed, bounded rectangle,
  // rather than the pre-6.1 model of an unbounded background sliding
  // independently across the whole viewport -- bounded pages and
  // parallax depth don't compose any other way without visible gaps at
  // the page edges.
  const updateCanvasTransform = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const scale = stage.scaleX();
    const pageLeft = stage.x();
    const pageTop = stage.y();
    const pageWidth = canvasConfig.width * scale;
    const pageHeight = canvasConfig.height * scale;

    if (backgroundRef.current) {
      backgroundRef.current.style.left = `${pageLeft}px`;
      backgroundRef.current.style.top = `${pageTop}px`;
      backgroundRef.current.style.width = `${pageWidth}px`;
      backgroundRef.current.style.height = `${pageHeight}px`;
      const bgX = canvasConfig.parallax.enabled ? stage.x() * canvasConfig.parallax.backgroundSpeed : 0;
      const bgY = canvasConfig.parallax.enabled ? stage.y() * canvasConfig.parallax.backgroundSpeed : 0;
      backgroundRef.current.style.backgroundPosition = `${bgX}px ${bgY}px`;
    }

    if (photoLayerRef.current) {
      photoLayerRef.current.style.left = `${pageLeft}px`;
      photoLayerRef.current.style.top = `${pageTop}px`;
      photoLayerRef.current.style.width = `${pageWidth}px`;
      photoLayerRef.current.style.height = `${pageHeight}px`;
    }
    // biome-ignore lint: size.width/size.height aren't read in the body, but the Stage (and stageRef.current) only
    // exists once they're > 0 -- this must re-run when that flips true, not just when config values change.
  }, [canvasConfig.width, canvasConfig.height, canvasConfig.parallax, size.width, size.height]);

  useEffect(() => {
    updateCanvasTransform();
  }, [updateCanvasTransform]);

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
      ...canvasConfig,
      zoom: stage.scaleX(),
      scrollX: stage.x(),
      scrollY: stage.y(),
    });
  }, [canvasConfig, onConfigChange]);

  const handleGridChange = useCallback(
    (patch: Partial<GridConfig>) => {
      onConfigChange({ ...canvasConfig, grid: { ...canvasConfig.grid, ...patch } });
    },
    [canvasConfig, onConfigChange],
  );

  const handleCanvasBackgroundChange = useCallback(
    (background: CanvasBackground) => {
      onConfigChange({ ...canvasConfig, canvasBackground: background });
    },
    [canvasConfig, onConfigChange],
  );

  const handleParallaxChange = useCallback(
    (patch: Partial<ParallaxConfig>) => {
      onConfigChange({ ...canvasConfig, parallax: { ...canvasConfig.parallax, ...patch } });
    },
    [canvasConfig, onConfigChange],
  );

  const handleSnapToGridChange = useCallback(
    (snapToGrid: boolean) => {
      onConfigChange({ ...canvasConfig, snapToGrid });
    },
    [canvasConfig, onConfigChange],
  );

  // Global Edit Mode: simplest possible drag-lock, deliberately built
  // before per-element locking -- ship this, see whether real use ever
  // actually needs finer-grained locks before building them speculatively.
  const handleEditModeChange = useCallback(
    (editMode: boolean) => {
      onConfigChange({ ...canvasConfig, editMode });
    },
    [canvasConfig, onConfigChange],
  );

  // Phase 6.2: snapping happens live during the drag (not just on drop) --
  // dragging a sticker jumps between grid positions as it moves, using the
  // same spacing the visible grid already draws at rather than a second,
  // independently-configurable number that could drift out of sync with it.
  const handleElementDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.target.moveToTop();
  }, []);

  // Elements are positioned/offset so Konva rotates them around their own
  // center (offsetX/Y = width/2, height/2), not the top-left corner --
  // node.x()/y() therefore hold the *center* in Konva's world, while
  // CanvasElement.x/y is stored as the top-left corner throughout the
  // rest of the app (sticker placement, import/export, etc.); every
  // read/write of node position converts between the two via the node's
  // own current offset.
  const handleElementDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!canvasConfig.snapToGrid) return;
      const spacing = canvasConfig.grid.spacing;
      const node = e.target;
      const left = Math.round((node.x() - node.offsetX()) / spacing) * spacing;
      const top = Math.round((node.y() - node.offsetY()) / spacing) * spacing;
      node.position({ x: left + node.offsetX(), y: top + node.offsetY() });
    },
    [canvasConfig.snapToGrid, canvasConfig.grid.spacing],
  );

  const handleElementDragEnd = useCallback(
    async (elementId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const maxZIndex = elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
      const patch = {
        x: node.x() - node.offsetX(),
        y: node.y() - node.offsetY(),
        zIndex: maxZIndex + 1,
      };
      await db.updateCanvasElement(elementId, patch);
      setElements((prev) => prev.map((el) => (el.id === elementId ? { ...el, ...patch } : el)));
    },
    [elements],
  );

  const handleSelectElement = useCallback(
    (elementId: string) => {
      if (!canvasConfig.editMode) return;
      setSelectedElementId(elementId);
    },
    [canvasConfig.editMode],
  );

  const handleDeselect = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedElementId(null);
    }
  }, []);

  // Konva's Transformer manipulates scaleX/scaleY, not width/height directly
  // -- the standard fix is to read the effective size off the scale, reset
  // scale to 1, and persist width/height/rotation directly, so the next
  // resize starts from a clean 1x scale instead of compounding.
  const handleElementTransformEnd = useCallback(
    async (elementId: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const width = Math.max(MIN_ELEMENT_SIZE, node.width() * scaleX);
      const height = Math.max(MIN_ELEMENT_SIZE, node.height() * scaleY);
      node.scaleX(1);
      node.scaleY(1);
      node.width(width);
      node.height(height);
      node.offsetX(width / 2);
      node.offsetY(height / 2);

      const patch = {
        x: node.x() - width / 2,
        y: node.y() - height / 2,
        width,
        height,
        rotation: node.rotation(),
      };
      await db.updateCanvasElement(elementId, patch);
      setElements((prev) => prev.map((el) => (el.id === elementId ? { ...el, ...patch } : el)));
    },
    [],
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (!canvasConfig.editMode || !selectedElementId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const node = elementNodeRefs.current[selectedElementId];
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedElementId, canvasConfig.editMode, elements]);

  // Selection (and its resize/rotate handles) only makes sense in Edit
  // Mode -- deselect immediately if a page gets locked while something's selected.
  useEffect(() => {
    if (!canvasConfig.editMode) setSelectedElementId(null);
  }, [canvasConfig.editMode]);

  const dragBoundFunc = useCallback(
    (pos: { x: number; y: number }) => {
      const scale = stageRef.current?.scaleX() ?? 1;
      return clampStagePosition(pos, scale, canvasConfig.width, canvasConfig.height, size.width, size.height);
    },
    [canvasConfig.width, canvasConfig.height, size.width, size.height],
  );

  const handleDragMove = useCallback(() => {
    updateCanvasTransform();
  }, [updateCanvasTransform]);

  const handleDragEnd = useCallback(() => {
    updateCanvasTransform();
    persistConfig();
  }, [updateCanvasTransform, persistConfig]);

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

      const rawPosition = {
        x: pointer.x - pointInWorld.x * newScale,
        y: pointer.y - pointInWorld.y * newScale,
      };
      const clamped = clampStagePosition(rawPosition, newScale, canvasConfig.width, canvasConfig.height, size.width, size.height);

      stage.scale({ x: newScale, y: newScale });
      stage.position(clamped);
      stage.batchDraw();
      updateCanvasTransform();
      persistConfig();
    },
    [persistConfig, updateCanvasTransform, canvasConfig.width, canvasConfig.height, size.width, size.height],
  );

  const zoomPercent = Math.round(canvasConfig.zoom * 100);

  const zoomBy = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const center = { x: size.width / 2, y: size.height / 2 };
      const oldScale = stage.scaleX();
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldScale * factor));
      const pointInWorld = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale };
      const rawPosition = { x: center.x - pointInWorld.x * newScale, y: center.y - pointInWorld.y * newScale };
      const clamped = clampStagePosition(rawPosition, newScale, canvasConfig.width, canvasConfig.height, size.width, size.height);
      stage.scale({ x: newScale, y: newScale });
      stage.position(clamped);
      stage.batchDraw();
      updateCanvasTransform();
      persistConfig();
    },
    [canvasConfig.width, canvasConfig.height, size.width, size.height, updateCanvasTransform, persistConfig],
  );

  return (
    <div className="entry-canvas">
      <div className="entry-canvas-toolbar">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <button type="button" disabled={!previousEntryId} onClick={() => previousEntryId && onNavigate(previousEntryId)}>
          ◀
        </button>
        <span>
          {entry.title} — Page {pageIndex + 1} of {pageCount}
        </span>
        <button type="button" disabled={!nextEntryId} onClick={() => nextEntryId && onNavigate(nextEntryId)}>
          ▶
        </button>
        <button type="button" onClick={onNewPage}>
          New Page
        </button>
        <button type="button" onClick={onDuplicatePage}>
          Duplicate Page
        </button>
        <button type="button" onClick={() => setPickerOpen((open) => !open)}>
          Add Sticker
        </button>
        <button type="button" onClick={() => setSettingsOpen((open) => !open)}>
          Canvas Settings
        </button>
        <button
          type="button"
          className={`entry-canvas-edit-toggle ${canvasConfig.editMode ? "is-editing" : "is-locked"}`}
          onClick={() => handleEditModeChange(!canvasConfig.editMode)}
        >
          {canvasConfig.editMode ? "Edit Mode: On" : "Edit Mode: Off (locked)"}
        </button>
        <span className="entry-canvas-zoom">
          <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP ** 8)}>
            −
          </button>
          {zoomPercent}%
          <button type="button" onClick={() => zoomBy(ZOOM_STEP ** 8)}>
            +
          </button>
        </span>
      </div>
      <div className="entry-canvas-surface" ref={containerRef} style={{ backgroundColor: VOID_COLOR }}>
        <div ref={backgroundRef} className="entry-canvas-background" style={backgroundCss(canvasConfig.canvasBackground)} />
        <div ref={photoLayerRef} className="entry-canvas-photo-layer" />
        {pickerOpen && (
          <div className="entry-canvas-floating-panel">
            <StickerPicker onPick={handlePickSticker} onClose={() => setPickerOpen(false)} />
          </div>
        )}
        {settingsOpen && (
          <div className="entry-canvas-floating-panel">
            <CanvasSettingsPanel
              grid={canvasConfig.grid}
              canvasBackground={canvasConfig.canvasBackground}
              parallax={canvasConfig.parallax}
              snapToGrid={canvasConfig.snapToGrid}
              onGridChange={handleGridChange}
              onCanvasBackgroundChange={handleCanvasBackgroundChange}
              onParallaxChange={handleParallaxChange}
              onSnapToGridChange={handleSnapToGridChange}
            />
          </div>
        )}
        {size.width > 0 && size.height > 0 && (
          <Stage
            ref={stageRef}
            className="entry-canvas-stage"
            width={size.width}
            height={size.height}
            draggable
            dragBoundFunc={dragBoundFunc}
            x={canvasConfig.scrollX}
            y={canvasConfig.scrollY}
            scaleX={canvasConfig.zoom}
            scaleY={canvasConfig.zoom}
            onWheel={handleWheel}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onClick={handleDeselect}
            onTap={handleDeselect}
          >
            <Layer listening={false}>
              <Rect
                x={0}
                y={0}
                width={canvasConfig.width}
                height={canvasConfig.height}
                stroke="#00000030"
                strokeWidth={1}
              />
            </Layer>
            <Layer listening={false}>
              <Grid config={canvasConfig.grid} pageWidth={canvasConfig.width} pageHeight={canvasConfig.height} />
            </Layer>
            <Layer>
              {[...elements]
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((element) =>
                  element.type === "sticker" ? (
                    <Group
                      key={element.id}
                      ref={(node) => {
                        if (node) elementNodeRefs.current[element.id] = node;
                        else delete elementNodeRefs.current[element.id];
                      }}
                      x={element.x + element.width / 2}
                      y={element.y + element.height / 2}
                      offsetX={element.width / 2}
                      offsetY={element.height / 2}
                      width={element.width}
                      height={element.height}
                      rotation={element.rotation}
                      opacity={element.opacity}
                      draggable={canvasConfig.editMode}
                      onDragStart={handleElementDragStart}
                      onDragMove={handleElementDragMove}
                      onDragEnd={(e) => handleElementDragEnd(element.id, e)}
                      onClick={() => handleSelectElement(element.id)}
                      onTap={() => handleSelectElement(element.id)}
                      onTransformEnd={(e) => handleElementTransformEnd(element.id, e)}
                    >
                      <Text
                        x={element.width / 2}
                        y={element.height / 2}
                        offsetX={element.width / 2}
                        offsetY={element.height / 2}
                        text={typeof element.content.src === "string" ? element.content.src : ""}
                        fontSize={element.height}
                      />
                    </Group>
                  ) : null,
                )}
              {canvasConfig.editMode && (
                <Transformer
                  ref={transformerRef}
                  keepRatio
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < MIN_ELEMENT_SIZE || newBox.height < MIN_ELEMENT_SIZE ? oldBox : newBox
                  }
                />
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}

function Grid({
  config,
  pageWidth,
  pageHeight,
}: {
  config: GridConfig;
  pageWidth: number;
  pageHeight: number;
}) {
  if (config.style === "blank") return null;

  return (
    <Shape
      listening={false}
      opacity={config.opacity}
      sceneFunc={(ctx) => {
        const spacing = config.spacing;
        const startX = 0;
        const endX = pageWidth;
        const startY = 0;
        const endY = pageHeight;

        ctx.fillStyle = config.color;
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1;

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
