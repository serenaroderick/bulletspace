import type { AssetDefinition } from "@bulletspace/core";

/**
 * Emoji as sticker "media" -- zero asset files needed to prove the
 * mechanism, and it's exactly what AssetItem.src supports (a literal, not
 * just data URLs). A real image-based pack works the same way once one
 * exists; nothing here is emoji-specific at the type level.
 */
export const basicStickerPack: AssetDefinition = {
  id: "basic-stickers",
  name: "Basic Stickers",
  version: "1.0.0",
  items: [
    { id: "sticker-star", name: "Star", kind: "sticker", src: "⭐" },
    { id: "sticker-heart", name: "Heart", kind: "sticker", src: "❤️" },
    { id: "sticker-check", name: "Check", kind: "sticker", src: "✅" },
    { id: "sticker-fire", name: "Fire", kind: "sticker", src: "🔥" },
    { id: "sticker-pin", name: "Pin", kind: "sticker", src: "📌" },
    { id: "sticker-party", name: "Party", kind: "sticker", src: "🎉" },
  ],
};

export const builtInAssetPacks: AssetDefinition[] = [basicStickerPack];
