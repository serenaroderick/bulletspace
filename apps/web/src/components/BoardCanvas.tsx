import type { AssetItem, Board, CanvasBackground, CanvasConfig, CanvasElement, GridConfig, ParallaxConfig } from "@bulletspace/core";
import type Konva from "konva";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Shape, Stage, Text, Transformer } from "react-konva";
import { Html } from "react-konva-utils";
import { db } from "../lib/db";
import type { ModuleId, ModuleRegistryEntry } from "../modules/registry";
import { texturePatterns } from "../themes/textures";
import { BoardModuleHost } from "./BoardModuleHost";
import { CanvasSettingsPanel } from "./CanvasSettingsPanel";
import { ModulePicker } from "./ModulePicker";
import { StickerPicker } from "./StickerPicker";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;
const STICKER_SIZE = 48;
const MIN_ELEMENT_SIZE = 16;
const BACKGROUND_TILE_SIZE = 64;
// The area outside the bounded page -- distinct from the page's own
// canvasBackground (deliberately theme-independent, see CanvasConfig's
// doc comment), but this outer void should still follow the active
// theme, not stay a fixed light gray when e.g. Midnight is active.
const VOID_COLOR = "var(--bs-color-border)";

function newElementId(): string {
  return crypto.randomUUID();
}

function newGroupId(): string {
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

interface BoardCanvasProps {
  board: Board;
  onConfigChange: (config: CanvasConfig) => void;
}

export function BoardCanvas({ board, onConfigChange }: BoardCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const photoLayerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const elementNodeRefs = useRef<Record<string, Konva.Group>>({});
  // Set on drag start when the dragged element is part of a multi-selection
  // -- lets handleElementDragMove/End move every other selected element by
  // the same delta, so a multi-select drags as one rigid unit.
  const multiDragRef = useRef<{ leaderId: string; startPositions: Record<string, { x: number; y: number }> } | null>(
    null,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);

  const { canvasConfig } = board;

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
    db.listCanvasElementsByBoard(board.id).then(setElements);
  }, [board.id]);

  // The background div is clipped to the board's on-screen projection (so
  // it never shows past the bounded canvas's edges -- the void around it
  // is a plain color), while its background-position keeps shifting at
  // parallax.backgroundSpeed of the true pan. That gives "the pattern
  // subtly shifts as you pan" depth *within* a fixed, bounded rectangle,
  // rather than an unbounded background sliding independently across the
  // whole viewport -- bounded canvases and parallax depth don't compose
  // any other way without visible gaps at the edges.
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
        boardId: board.id,
        type: "sticker",
        content: { src: sticker.src },
        x: centerX,
        y: centerY,
        width: STICKER_SIZE,
        height: STICKER_SIZE,
        zIndex: elements.length,
        rotation: 0,
        opacity: 1,
        groupId: null,
      };

      await db.createCanvasElement(element);
      setElements((prev) => [...prev, element]);
      setPickerOpen(false);
    },
    [board.id, elements.length, size.width, size.height],
  );

  const handlePickModule = useCallback(
    async (module: ModuleRegistryEntry) => {
      const stage = stageRef.current;
      const scale = stage?.scaleX() ?? 1;
      const stageX = stage?.x() ?? 0;
      const stageY = stage?.y() ?? 0;
      const centerX = (size.width / 2 - stageX) / scale - module.defaultWidth / 2;
      const centerY = (size.height / 2 - stageY) / scale - module.defaultHeight / 2;

      const element: CanvasElement = {
        id: newElementId(),
        boardId: board.id,
        type: "module",
        content: { moduleId: module.id },
        x: centerX,
        y: centerY,
        width: module.defaultWidth,
        height: module.defaultHeight,
        zIndex: elements.length,
        rotation: 0,
        opacity: 1,
        groupId: null,
      };

      await db.createCanvasElement(element);
      setElements((prev) => [...prev, element]);
      setModulePickerOpen(false);
    },
    [board.id, elements.length, size.width, size.height],
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
  // dragging an element jumps between grid positions as it moves, using the
  // same spacing the visible grid already draws at rather than a second,
  // independently-configurable number that could drift out of sync with it.
  // When the dragged element is part of a multi-selection, every other
  // selected element records its starting position too, so the whole
  // selection can move together as one rigid unit (see handleElementDragMove).
  const handleElementDragStart = useCallback(
    (elementId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      e.target.moveToTop();
      if (selectedElementIds.length > 1 && selectedElementIds.includes(elementId)) {
        const startPositions: Record<string, { x: number; y: number }> = {};
        for (const id of selectedElementIds) {
          const node = elementNodeRefs.current[id];
          if (node) startPositions[id] = { x: node.x(), y: node.y() };
        }
        multiDragRef.current = { leaderId: elementId, startPositions };
      } else {
        multiDragRef.current = null;
      }
    },
    [selectedElementIds],
  );

  // Elements are positioned/offset so Konva rotates them around their own
  // center (offsetX/Y = width/2, height/2), not the top-left corner --
  // node.x()/y() therefore hold the *center* in Konva's world, while
  // CanvasElement.x/y is stored as the top-left corner throughout the
  // rest of the app (sticker placement, import/export, etc.); every
  // read/write of node position converts between the two via the node's
  // own current offset.
  const handleElementDragMove = useCallback(
    (elementId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      if (canvasConfig.snapToGrid) {
        const spacing = canvasConfig.grid.spacing;
        const left = Math.round((node.x() - node.offsetX()) / spacing) * spacing;
        const top = Math.round((node.y() - node.offsetY()) / spacing) * spacing;
        node.position({ x: left + node.offsetX(), y: top + node.offsetY() });
      }

      const drag = multiDragRef.current;
      if (drag && drag.leaderId === elementId) {
        const start = drag.startPositions[elementId];
        const dx = node.x() - start.x;
        const dy = node.y() - start.y;
        for (const [id, startPos] of Object.entries(drag.startPositions)) {
          if (id === elementId) continue;
          elementNodeRefs.current[id]?.position({ x: startPos.x + dx, y: startPos.y + dy });
        }
      }
    },
    [canvasConfig.snapToGrid, canvasConfig.grid.spacing],
  );

  const handleElementDragEnd = useCallback(
    async (elementId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const maxZIndex = elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
      const drag = multiDragRef.current;
      const idsToUpdate = drag && drag.leaderId === elementId ? Object.keys(drag.startPositions) : [elementId];

      const patches: Record<string, Partial<CanvasElement>> = {};
      for (const id of idsToUpdate) {
        const targetNode = id === elementId ? node : elementNodeRefs.current[id];
        if (!targetNode) continue;
        patches[id] = {
          x: targetNode.x() - targetNode.offsetX(),
          y: targetNode.y() - targetNode.offsetY(),
          ...(id === elementId ? { zIndex: maxZIndex + 1 } : {}),
        };
      }
      multiDragRef.current = null;

      await Promise.all(Object.entries(patches).map(([id, patch]) => db.updateCanvasElement(id, patch)));
      setElements((prev) => prev.map((el) => (patches[el.id] ? { ...el, ...patches[el.id] } : el)));
    },
    [elements],
  );

  // Clicking a grouped element selects the whole group (shift+click still
  // toggles the group's membership in/out of a larger selection, rather
  // than picking apart the group itself -- Cmd+G'd elements always move,
  // resize, and get deleted as one unit until explicitly ungrouped).
  const handleSelectElement = useCallback(
    (elementId: string, additive: boolean) => {
      if (!canvasConfig.editMode) return;
      const clicked = elements.find((el) => el.id === elementId);
      const groupMemberIds = clicked?.groupId
        ? elements.filter((el) => el.groupId === clicked.groupId).map((el) => el.id)
        : [elementId];

      setSelectedElementIds((prev) => {
        if (!additive) return groupMemberIds;
        const alreadyAllSelected = groupMemberIds.every((id) => prev.includes(id));
        return alreadyAllSelected
          ? prev.filter((id) => !groupMemberIds.includes(id))
          : [...new Set([...prev, ...groupMemberIds])];
      });
    },
    [canvasConfig.editMode, elements],
  );

  const handleDeselect = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedElementIds([]);
      setContextMenu(null);
    }
  }, []);

  const handleElementContextMenu = useCallback(
    (elementId: string, e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      if (!canvasConfig.editMode) return;
      setSelectedElementIds((prev) => (prev.includes(elementId) ? prev : [elementId]));
      setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, elementId });
    },
    [canvasConfig.editMode],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleBringToFront = useCallback(async () => {
    const maxZIndex = elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
    const patches = new Map(selectedElementIds.map((id, i) => [id, { zIndex: maxZIndex + 1 + i }]));
    await Promise.all([...patches.entries()].map(([id, patch]) => db.updateCanvasElement(id, patch)));
    setElements((prev) => prev.map((el) => (patches.has(el.id) ? { ...el, ...patches.get(el.id) } : el)));
    closeContextMenu();
  }, [elements, selectedElementIds, closeContextMenu]);

  const handleSendToBack = useCallback(async () => {
    const minZIndex = elements.reduce((min, el) => Math.min(min, el.zIndex), 0);
    const patches = new Map(
      selectedElementIds.map((id, i) => [id, { zIndex: minZIndex - selectedElementIds.length + i }]),
    );
    await Promise.all([...patches.entries()].map(([id, patch]) => db.updateCanvasElement(id, patch)));
    setElements((prev) => prev.map((el) => (patches.has(el.id) ? { ...el, ...patches.get(el.id) } : el)));
    closeContextMenu();
  }, [elements, selectedElementIds, closeContextMenu]);

  const handleDuplicateSelected = useCallback(async () => {
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length === 0) return;
    const duplicateGroupId = selected.some((el) => el.groupId) ? newGroupId() : null;
    const maxZIndex = elements.reduce((max, el) => Math.max(max, el.zIndex), 0);

    const copies = selected.map((el, i) => ({
      ...el,
      id: newElementId(),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: maxZIndex + 1 + i,
      groupId: duplicateGroupId,
    }));

    await Promise.all(copies.map((copy) => db.createCanvasElement(copy)));
    setElements((prev) => [...prev, ...copies]);
    setSelectedElementIds(copies.map((copy) => copy.id));
    closeContextMenu();
  }, [elements, selectedElementIds, closeContextMenu]);

  const handleDeleteSelected = useCallback(async () => {
    await Promise.all(selectedElementIds.map((id) => db.deleteCanvasElement(id)));
    setElements((prev) => prev.filter((el) => !selectedElementIds.includes(el.id)));
    setSelectedElementIds([]);
    closeContextMenu();
  }, [selectedElementIds, closeContextMenu]);

  // "Ungroup" shows only when the selection is exactly one existing group
  // -- every selected element shares the same groupId, and no other
  // member of that group is left unselected.
  const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
  const commonGroupId = selectedElements[0]?.groupId ?? null;
  const isSelectionOneFullGroup =
    selectedElements.length > 1 &&
    commonGroupId !== null &&
    selectedElements.every((el) => el.groupId === commonGroupId) &&
    elements.filter((el) => el.groupId === commonGroupId).length === selectedElements.length;
  // Modules render real interactive DOM (buttons/forms), so rotating one
  // doesn't make sense, and a free (non-square) aspect ratio does -- both
  // only apply when every selected element is a sticker.
  const onlyStickersSelected = selectedElements.every((el) => el.type === "sticker");

  const handleGroupSelected = useCallback(async () => {
    if (selectedElementIds.length < 2) return;
    const groupId = newGroupId();
    await Promise.all(selectedElementIds.map((id) => db.updateCanvasElement(id, { groupId })));
    setElements((prev) => prev.map((el) => (selectedElementIds.includes(el.id) ? { ...el, groupId } : el)));
    closeContextMenu();
  }, [selectedElementIds, closeContextMenu]);

  const handleUngroupSelected = useCallback(async () => {
    await Promise.all(selectedElementIds.map((id) => db.updateCanvasElement(id, { groupId: null })));
    setElements((prev) => prev.map((el) => (selectedElementIds.includes(el.id) ? { ...el, groupId: null } : el)));
    closeContextMenu();
  }, [selectedElementIds, closeContextMenu]);

  // Cmd/Ctrl+G groups the current selection; Cmd/Ctrl+Shift+G ungroups it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canvasConfig.editMode || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "g") return;
      e.preventDefault();
      if (e.shiftKey) {
        handleUngroupSelected();
      } else {
        handleGroupSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvasConfig.editMode, handleGroupSelected, handleUngroupSelected]);

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

    if (!canvasConfig.editMode || selectedElementIds.length === 0) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedElementIds
      .map((id) => elementNodeRefs.current[id])
      .filter((node): node is Konva.Group => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedElementIds, canvasConfig.editMode, elements]);

  // Selection (and its resize/rotate handles) only makes sense in Edit
  // Mode -- deselect immediately if the board gets locked while something's selected.
  useEffect(() => {
    if (!canvasConfig.editMode) {
      setSelectedElementIds([]);
      setContextMenu(null);
    }
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
    <div className="board-canvas">
      <div className="board-canvas-toolbar">
        <span>{board.name}</span>
        <button type="button" onClick={() => setPickerOpen((open) => !open)}>
          Add Sticker
        </button>
        <button type="button" onClick={() => setModulePickerOpen((open) => !open)}>
          Add Module
        </button>
        <button type="button" onClick={() => setSettingsOpen((open) => !open)}>
          Canvas Settings
        </button>
        <button
          type="button"
          className={`board-canvas-edit-toggle ${canvasConfig.editMode ? "is-editing" : "is-locked"}`}
          onClick={() => handleEditModeChange(!canvasConfig.editMode)}
        >
          {canvasConfig.editMode ? "Edit Mode: On" : "Edit Mode: Off (locked)"}
        </button>
        <span className="board-canvas-zoom">
          <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP ** 8)}>
            −
          </button>
          {zoomPercent}%
          <button type="button" onClick={() => zoomBy(ZOOM_STEP ** 8)}>
            +
          </button>
        </span>
      </div>
      <div className="board-canvas-surface" ref={containerRef} style={{ backgroundColor: VOID_COLOR }}>
        <div ref={backgroundRef} className="board-canvas-background" style={backgroundCss(canvasConfig.canvasBackground)} />
        <div ref={photoLayerRef} className="board-canvas-photo-layer" />
        {pickerOpen && (
          <div className="board-canvas-floating-panel">
            <StickerPicker onPick={handlePickSticker} onClose={() => setPickerOpen(false)} />
          </div>
        )}
        {modulePickerOpen && (
          <div className="board-canvas-floating-panel">
            <ModulePicker onPick={handlePickModule} onClose={() => setModulePickerOpen(false)} />
          </div>
        )}
        {settingsOpen && (
          <div className="board-canvas-floating-panel">
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
            className="board-canvas-stage"
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
                .map((element) => {
                  const commonHandlers = {
                    ref: (node: Konva.Group | null) => {
                      if (node) elementNodeRefs.current[element.id] = node;
                      else delete elementNodeRefs.current[element.id];
                    },
                    x: element.x + element.width / 2,
                    y: element.y + element.height / 2,
                    offsetX: element.width / 2,
                    offsetY: element.height / 2,
                    width: element.width,
                    height: element.height,
                    rotation: element.rotation,
                    opacity: element.opacity,
                    draggable: canvasConfig.editMode,
                    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => handleElementDragStart(element.id, e),
                    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => handleElementDragMove(element.id, e),
                    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleElementDragEnd(element.id, e),
                    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleSelectElement(element.id, e.evt.shiftKey),
                    onTap: () => handleSelectElement(element.id, false),
                    onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => handleElementContextMenu(element.id, e),
                    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleElementTransformEnd(element.id, e),
                  };

                  if (element.type === "sticker") {
                    return (
                      <Group key={element.id} {...commonHandlers} align="center" verticalAlign="middle">
                        <Text
                          x={element.width / 2}
                          y={element.height / 2}
                          offsetX={element.width / 2}
                          offsetY={element.height / 2}
                          text={typeof element.content.src === "string" ? element.content.src : ""}
                          fontSize={element.height}
                        />
                      </Group>
                    );
                  }

                  if (element.type === "module") {
                    return (
                      <Group key={element.id} {...commonHandlers}>
                        {/* Html draws nothing on the actual Konva canvas -- it's a pure
                            DOM overlay -- so without a real Shape here, Konva's hit
                            graph has nothing at this position and drag/click/context-
                            menu would never reach the Group at all. This Rect is
                            invisible (fill "transparent" still gets hit-tested; only
                            listening={false} would skip it) but gives Konva real
                            geometry to route pointer events to. */}
                        <Rect x={0} y={0} width={element.width} height={element.height} fill="transparent" />
                        {/* pointerEvents: none on the overlay itself is what lets drag/
                            click/context-menu on the module's body reach the Konva Group
                            underneath at all -- without it, this div (being real DOM,
                            not canvas pixels) swallows every pointer event over its full
                            width/height before Konva ever sees it. .module's CSS
                            re-enables pointer-events on the actual interactive controls
                            (buttons/inputs/etc.) inside, so those keep working. */}
                        <Html
                          divProps={{
                            style: {
                              width: element.width,
                              height: element.height,
                              zIndex: 10 + element.zIndex,
                              pointerEvents: "none",
                            },
                          }}
                        >
                          <BoardModuleHost moduleId={element.content.moduleId as ModuleId} />
                        </Html>
                      </Group>
                    );
                  }

                  return null;
                })}
              {canvasConfig.editMode && (
                <Transformer
                  ref={transformerRef}
                  keepRatio={onlyStickersSelected}
                  rotateEnabled={onlyStickersSelected}
                  // Resize is sticker/photo-only for now (modules resize the
                  // bounding box without their content actually adapting to
                  // it yet -- revisit once modules have real responsive
                  // layout). Empty anchors means the selection outline still
                  // shows (so drag/group selection stays visible) but there's
                  // nothing to grab.
                  enabledAnchors={onlyStickersSelected ? ["top-left", "top-right", "bottom-left", "bottom-right"] : []}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < MIN_ELEMENT_SIZE || newBox.height < MIN_ELEMENT_SIZE ? oldBox : newBox
                  }
                />
              )}
            </Layer>
          </Stage>
        )}
        {contextMenu && (
          <ElementContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            canGroup={selectedElementIds.length >= 2 && !isSelectionOneFullGroup}
            canUngroup={isSelectionOneFullGroup}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onDuplicate={handleDuplicateSelected}
            onDelete={handleDeleteSelected}
            onGroup={handleGroupSelected}
            onUngroup={handleUngroupSelected}
            onClose={closeContextMenu}
          />
        )}
      </div>
    </div>
  );
}

function ElementContextMenu({
  x,
  y,
  canGroup,
  canUngroup,
  onBringToFront,
  onSendToBack,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onClose,
}: {
  x: number;
  y: number;
  canGroup: boolean;
  canUngroup: boolean;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const runAndClose = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <>
      {/* Full-viewport catcher so any click outside the menu closes it, without
          needing a document-level listener that'd also have to filter clicks
          landing inside the menu itself. */}
      <div className="board-canvas-context-menu-backdrop" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="board-canvas-context-menu" style={{ left: x, top: y }}>
        <button type="button" onClick={runAndClose(onBringToFront)}>
          Bring to Front
        </button>
        <button type="button" onClick={runAndClose(onSendToBack)}>
          Send to Back
        </button>
        <button type="button" onClick={runAndClose(onDuplicate)}>
          Duplicate
        </button>
        {canGroup && (
          <button type="button" onClick={runAndClose(onGroup)}>
            Group
          </button>
        )}
        {canUngroup && (
          <button type="button" onClick={runAndClose(onUngroup)}>
            Ungroup
          </button>
        )}
        <button type="button" className="board-canvas-context-menu-danger" onClick={runAndClose(onDelete)}>
          Delete
        </button>
      </div>
    </>
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
