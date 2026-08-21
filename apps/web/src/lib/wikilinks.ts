const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface Wikilink {
  target: string;
  alias: string | null;
}

export function extractWikilinks(content: string): Wikilink[] {
  const links: Wikilink[] = [];
  for (const match of content.matchAll(WIKILINK_PATTERN)) {
    links.push({ target: match[1].trim(), alias: match[2]?.trim() ?? null });
  }
  return links;
}

/** Rewrites [[Target]] / [[Target|Alias]] into standard Markdown links a renderer can handle. */
export function toMarkdownLinks(content: string): string {
  return content.replace(WIKILINK_PATTERN, (_match, target: string, alias?: string) => {
    const label = (alias ?? target).trim();
    const href = `bulletspace://entry/${encodeURIComponent(target.trim())}`;
    return `[${label}](${href})`;
  });
}

export function findBacklinks<T extends { id: string; title: string; content: string }>(
  entries: T[],
  targetTitle: string,
): T[] {
  const normalizedTarget = targetTitle.trim().toLowerCase();
  return entries.filter((entry) =>
    extractWikilinks(entry.content).some((link) => link.target.toLowerCase() === normalizedTarget),
  );
}
