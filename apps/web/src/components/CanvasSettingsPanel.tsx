import type { CanvasBackground, GridConfig, ParallaxConfig, ThemeGridStyle } from "@bulletspace/core";
import type { ChangeEvent } from "react";
import { builtInTextureIds } from "../themes/textures";

interface CanvasSettingsPanelProps {
  grid: GridConfig;
  canvasBackground: CanvasBackground;
  parallax: ParallaxConfig;
  onGridChange: (patch: Partial<GridConfig>) => void;
  onCanvasBackgroundChange: (background: CanvasBackground) => void;
  onParallaxChange: (patch: Partial<ParallaxConfig>) => void;
}

const GRID_STYLES: ThemeGridStyle[] = ["dot", "lined", "graph", "blank"];

/**
 * Live settings for the currently open entry's canvas -- grid style/
 * spacing/color/opacity, background type/value, and parallax. Edits the
 * working theme in place (App.tsx's handleGridChange/etc.), not a saved
 * theme -- use ThemeSharePanel's Share button to turn a tweak into a
 * theme others can install.
 */
export function CanvasSettingsPanel({
  grid,
  canvasBackground,
  parallax,
  onGridChange,
  onCanvasBackgroundChange,
  onParallaxChange,
}: CanvasSettingsPanelProps) {
  const handleBackgroundTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value;
    if (type === "color") {
      onCanvasBackgroundChange({ type: "color", value: canvasBackground.type === "color" ? canvasBackground.value : "#ffffff" });
    } else if (type === "gradient") {
      onCanvasBackgroundChange({ type: "gradient", from: "#ffffff", to: "#dddddd", angleDeg: 45 });
    } else if (type === "texture") {
      onCanvasBackgroundChange({ type: "texture", textureId: builtInTextureIds[0] });
    } else {
      onCanvasBackgroundChange({ type: "image", dataUrl: "" });
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onCanvasBackgroundChange({ type: "image", dataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="module canvas-settings-panel">
      <h3>Canvas</h3>

      <div className="canvas-settings-row">
        <label htmlFor="grid-style">Grid style</label>
        <select
          id="grid-style"
          value={grid.style}
          onChange={(event) => onGridChange({ style: event.target.value as ThemeGridStyle })}
        >
          {GRID_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>

      <div className="canvas-settings-row">
        <label htmlFor="grid-spacing">Spacing</label>
        <input
          id="grid-spacing"
          type="number"
          min={4}
          max={200}
          value={grid.spacing}
          onChange={(event) => onGridChange({ spacing: Number(event.target.value) || grid.spacing })}
        />
      </div>

      <div className="canvas-settings-row">
        <label htmlFor="grid-color">Grid color</label>
        <input
          id="grid-color"
          type="color"
          value={grid.color}
          onChange={(event) => onGridChange({ color: event.target.value })}
        />
      </div>

      <div className="canvas-settings-row">
        <label htmlFor="grid-opacity">Grid opacity</label>
        <input
          id="grid-opacity"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={grid.opacity}
          onChange={(event) => onGridChange({ opacity: Number(event.target.value) })}
        />
      </div>

      <div className="canvas-settings-row">
        <label htmlFor="bg-type">Background</label>
        <select id="bg-type" value={canvasBackground.type} onChange={handleBackgroundTypeChange}>
          <option value="color">Solid color</option>
          <option value="gradient">Gradient</option>
          <option value="texture">Texture</option>
          <option value="image">Image</option>
        </select>
      </div>

      {canvasBackground.type === "color" && (
        <div className="canvas-settings-row">
          <label htmlFor="bg-color">Color</label>
          <input
            id="bg-color"
            type="color"
            value={canvasBackground.value}
            onChange={(event) => onCanvasBackgroundChange({ type: "color", value: event.target.value })}
          />
        </div>
      )}

      {canvasBackground.type === "gradient" && (
        <>
          <div className="canvas-settings-row">
            <label htmlFor="bg-gradient-from">From</label>
            <input
              id="bg-gradient-from"
              type="color"
              value={canvasBackground.from}
              onChange={(event) => onCanvasBackgroundChange({ ...canvasBackground, from: event.target.value })}
            />
          </div>
          <div className="canvas-settings-row">
            <label htmlFor="bg-gradient-to">To</label>
            <input
              id="bg-gradient-to"
              type="color"
              value={canvasBackground.to}
              onChange={(event) => onCanvasBackgroundChange({ ...canvasBackground, to: event.target.value })}
            />
          </div>
          <div className="canvas-settings-row">
            <label htmlFor="bg-gradient-angle">Angle</label>
            <input
              id="bg-gradient-angle"
              type="number"
              min={0}
              max={360}
              value={canvasBackground.angleDeg}
              onChange={(event) =>
                onCanvasBackgroundChange({ ...canvasBackground, angleDeg: Number(event.target.value) || 0 })
              }
            />
          </div>
        </>
      )}

      {canvasBackground.type === "texture" && (
        <div className="canvas-settings-row">
          <label htmlFor="bg-texture">Pattern</label>
          <select
            id="bg-texture"
            value={canvasBackground.textureId}
            onChange={(event) => onCanvasBackgroundChange({ type: "texture", textureId: event.target.value })}
          >
            {builtInTextureIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      )}

      {canvasBackground.type === "image" && (
        <div className="canvas-settings-row">
          <label htmlFor="bg-image">Upload</label>
          <input id="bg-image" type="file" accept="image/*" onChange={handleImageUpload} />
        </div>
      )}

      <div className="canvas-settings-row">
        <label htmlFor="parallax-enabled">Parallax</label>
        <input
          id="parallax-enabled"
          type="checkbox"
          checked={parallax.enabled}
          onChange={(event) => onParallaxChange({ enabled: event.target.checked })}
        />
      </div>

      <div className="canvas-settings-row">
        <label htmlFor="parallax-bg-speed">Background speed</label>
        <input
          id="parallax-bg-speed"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={parallax.backgroundSpeed}
          onChange={(event) => onParallaxChange({ backgroundSpeed: Number(event.target.value) })}
        />
      </div>

      <div className="canvas-settings-row">
        <label htmlFor="parallax-photo-speed">Photo speed</label>
        <input
          id="parallax-photo-speed"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={parallax.photoSpeed}
          onChange={(event) => onParallaxChange({ photoSpeed: Number(event.target.value) })}
        />
      </div>
    </div>
  );
}
