import type { AdapterDefinition, DataPayload } from "@bulletspace/core";
import { db } from "./db";

export interface SwrResult {
  payload: DataPayload;
  isStale: boolean;
}

/**
 * Stale-while-revalidate: a cached payload (fresh or stale) is returned
 * immediately. If it's stale, a background refetch updates the cache for
 * next time -- failures there are silent since the caller already has data
 * to show; the next explicit refresh will surface any real problem. If
 * nothing is cached yet, this awaits the fetch.
 */
export async function fetchWithCache(
  adapterDef: AdapterDefinition,
  fetchFn: () => Promise<DataPayload>,
  onRevalidated?: (payload: DataPayload) => void,
): Promise<SwrResult> {
  const cached = await db.getCachedAdapterData(adapterDef.id);
  const now = Date.now();

  if (cached) {
    const ageSeconds = (now - cached.cachedAt) / 1000;
    const isStale = ageSeconds > adapterDef.defaultTtlSeconds;
    if (isStale) {
      fetchFn()
        .then(async (payload) => {
          await db.setCachedAdapterData({ adapterId: adapterDef.id, payload, cachedAt: Date.now() });
          onRevalidated?.(payload);
        })
        .catch(() => {});
    }
    return { payload: cached.payload, isStale };
  }

  const payload = await fetchFn();
  await db.setCachedAdapterData({ adapterId: adapterDef.id, payload, cachedAt: now });
  return { payload, isStale: false };
}

export async function getCachedPayload(adapterId: string): Promise<DataPayload | undefined> {
  const cached = await db.getCachedAdapterData(adapterId);
  return cached?.payload;
}
