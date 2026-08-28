import type { AssetDefinition, AssetItem } from "@bulletspace/core";
import { builtInAssetPacks } from "../assets/registry";
import { db } from "./db";

/** Built-in asset packs plus whatever's been imported (Phase 5.5 manual sharing) -- same split as themes. */
export async function listAllAssetPacks(): Promise<AssetDefinition[]> {
  const installed = await db.listAssetDefinitions();
  return [...builtInAssetPacks, ...installed];
}

export async function listAllStickers(): Promise<AssetItem[]> {
  const packs = await listAllAssetPacks();
  return packs.flatMap((pack) => pack.items).filter((item) => item.kind === "sticker");
}
