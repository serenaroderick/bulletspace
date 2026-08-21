/** Parses a free-text rating input into a 1-10 integer, or null if empty/invalid. */
export function clampRating(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
