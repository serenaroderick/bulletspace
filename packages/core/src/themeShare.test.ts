import { describe, expect, it } from "vitest";
import {
  parseAssetShare,
  parseThemeShare,
  serializeAssetShare,
  serializeThemeShare,
} from "./themeShare.js";
import type { AssetDefinition, ThemeDefinition } from "./theme.js";

const sepia: ThemeDefinition = {
  id: "sepia",
  name: "Sepia",
  version: "1.0.0",
  colors: {
    background: "#f4ecd8",
    surface: "#ffffff",
    text: "#3b2f2f",
    textMuted: "#7a6a58",
    accent: "#a0522d",
    border: "#d8c9a8",
  },
  fontFamily: "Georgia, serif",
  spacingUnit: 8,
  cornerRadius: 4,
  lineThickness: 1,
  gridStyle: "dot",
  canvasBackground: { type: "color", value: "#f4ecd8" },
};

const stickerPack: AssetDefinition = {
  id: "basic-stickers",
  name: "Basic Stickers",
  version: "1.0.0",
  items: [{ id: "star", name: "Star", kind: "sticker", src: "⭐" }],
};

describe("serializeThemeShare / parseThemeShare", () => {
  it("round-trips a theme definition", () => {
    const share = serializeThemeShare(sepia);
    const parsed = parseThemeShare(JSON.stringify(share));
    expect(parsed).toEqual(share);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseThemeShare("not json")).toThrow("Not valid JSON.");
  });

  it("rejects an unsupported version", () => {
    const share = serializeThemeShare(sepia);
    expect(() => parseThemeShare(JSON.stringify({ ...share, version: 2 }))).toThrow(
      "Not a valid BulletSpace theme file.",
    );
  });

  it("rejects a theme missing required color fields", () => {
    const malformed = { version: 1, kind: "theme", theme: { id: "x", name: "X", version: "1.0.0" } };
    expect(() => parseThemeShare(JSON.stringify(malformed))).toThrow("Not a valid BulletSpace theme file.");
  });

  it("rejects an asset pack file passed as a theme", () => {
    const assetShare = serializeAssetShare(stickerPack);
    expect(() => parseThemeShare(JSON.stringify(assetShare))).toThrow("Not a valid BulletSpace theme file.");
  });
});

describe("serializeAssetShare / parseAssetShare", () => {
  it("round-trips an asset pack", () => {
    const share = serializeAssetShare(stickerPack);
    const parsed = parseAssetShare(JSON.stringify(share));
    expect(parsed).toEqual(share);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseAssetShare("not json")).toThrow("Not valid JSON.");
  });

  it("rejects an item with an invalid kind", () => {
    const malformed = {
      version: 1,
      kind: "assetPack",
      assetPack: { id: "x", name: "X", version: "1.0.0", items: [{ id: "a", name: "A", kind: "video", src: "x" }] },
    };
    expect(() => parseAssetShare(JSON.stringify(malformed))).toThrow("Not a valid BulletSpace asset pack file.");
  });

  it("rejects a theme file passed as an asset pack", () => {
    const themeShare = serializeThemeShare(sepia);
    expect(() => parseAssetShare(JSON.stringify(themeShare))).toThrow("Not a valid BulletSpace asset pack file.");
  });
});
