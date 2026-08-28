import type { AssetDefinition, ThemeDefinition } from "./theme.js";

export interface ThemeShareFile {
  version: 1;
  kind: "theme";
  theme: ThemeDefinition;
}

export function serializeThemeShare(theme: ThemeDefinition): ThemeShareFile {
  return { version: 1, kind: "theme", theme };
}

const VALID_GRID_STYLES = ["dot", "lined", "blank", "graph"];

function isValidGridConfig(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const grid = value as Record<string, unknown>;
  return (
    VALID_GRID_STYLES.includes(grid.style as string) &&
    typeof grid.spacing === "number" &&
    typeof grid.color === "string" &&
    typeof grid.opacity === "number"
  );
}

function isValidParallaxConfig(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const parallax = value as Record<string, unknown>;
  return (
    typeof parallax.enabled === "boolean" &&
    typeof parallax.backgroundSpeed === "number" &&
    typeof parallax.photoSpeed === "number"
  );
}

function isValidThemeDefinition(value: unknown): value is ThemeDefinition {
  if (typeof value !== "object" || value === null) return false;
  const theme = value as Record<string, unknown>;
  const colors = theme.colors as Record<string, unknown> | undefined;
  return (
    typeof theme.id === "string" &&
    typeof theme.name === "string" &&
    typeof theme.version === "string" &&
    typeof colors === "object" &&
    colors !== null &&
    typeof colors.background === "string" &&
    typeof colors.surface === "string" &&
    typeof colors.text === "string" &&
    typeof colors.textMuted === "string" &&
    typeof colors.accent === "string" &&
    typeof colors.border === "string" &&
    typeof theme.fontFamily === "string" &&
    typeof theme.spacingUnit === "number" &&
    typeof theme.cornerRadius === "number" &&
    typeof theme.lineThickness === "number" &&
    isValidGridConfig(theme.grid) &&
    typeof theme.canvasBackground === "object" &&
    theme.canvasBackground !== null &&
    isValidParallaxConfig(theme.parallax)
  );
}

export function parseThemeShare(raw: string): ThemeShareFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Not valid JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    (parsed as { kind?: unknown }).kind !== "theme" ||
    !isValidThemeDefinition((parsed as { theme?: unknown }).theme)
  ) {
    throw new Error("Not a valid BulletSpace theme file.");
  }

  return parsed as ThemeShareFile;
}

export interface AssetShareFile {
  version: 1;
  kind: "assetPack";
  assetPack: AssetDefinition;
}

export function serializeAssetShare(assetPack: AssetDefinition): AssetShareFile {
  return { version: 1, kind: "assetPack", assetPack };
}

function isValidAssetDefinition(value: unknown): value is AssetDefinition {
  if (typeof value !== "object" || value === null) return false;
  const pack = value as Record<string, unknown>;
  if (
    typeof pack.id !== "string" ||
    typeof pack.name !== "string" ||
    typeof pack.version !== "string" ||
    !Array.isArray(pack.items)
  ) {
    return false;
  }
  return pack.items.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    const asset = item as Record<string, unknown>;
    return (
      typeof asset.id === "string" &&
      typeof asset.name === "string" &&
      (asset.kind === "sticker" || asset.kind === "icon" || asset.kind === "font") &&
      typeof asset.src === "string"
    );
  });
}

export function parseAssetShare(raw: string): AssetShareFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Not valid JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    (parsed as { kind?: unknown }).kind !== "assetPack" ||
    !isValidAssetDefinition((parsed as { assetPack?: unknown }).assetPack)
  ) {
    throw new Error("Not a valid BulletSpace asset pack file.");
  }

  return parsed as AssetShareFile;
}
