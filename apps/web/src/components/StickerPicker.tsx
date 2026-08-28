import type { AssetItem } from "@bulletspace/core";
import { useEffect, useState } from "react";
import { listAllStickers } from "../lib/assets";

interface StickerPickerProps {
  onPick: (sticker: AssetItem) => void;
  onClose: () => void;
}

export function StickerPicker({ onPick, onClose }: StickerPickerProps) {
  const [stickers, setStickers] = useState<AssetItem[]>([]);

  useEffect(() => {
    listAllStickers().then(setStickers);
  }, []);

  return (
    <div className="sticker-picker">
      <div className="sticker-picker-header">
        <span>Stickers</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {stickers.length === 0 ? (
        <p className="empty">No stickers installed.</p>
      ) : (
        <div className="sticker-picker-grid">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              className="sticker-picker-item"
              title={sticker.name}
              aria-label={sticker.name}
              onClick={() => onPick(sticker)}
            >
              {sticker.src}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
