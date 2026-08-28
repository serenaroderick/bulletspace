import { type ThemeDefinition, parseThemeShare, serializeThemeShare } from "@bulletspace/core";
import { useCallback, useState } from "react";
import { db } from "../lib/db";
import { builtInThemes } from "../themes/registry";

interface ThemeSharePanelProps {
  themes: ThemeDefinition[];
  activeTheme: ThemeDefinition;
  onThemesChange: () => void;
}

const builtInIds = new Set(builtInThemes.map((theme) => theme.id));

/**
 * Manual theme sharing -- the same copy-paste mechanism Phase 4 proved
 * for modules (SharedModulesPanel), extended to themes per Phase 5.5.
 * Unlike Adapters, a theme is pure data (colors/fonts/spacing), so the
 * whole thing travels as real content, same trust tier as Modules --
 * no manifest-only restriction needed here.
 */
export function ThemeSharePanel({ themes, activeTheme, onThemesChange }: ThemeSharePanelProps) {
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ThemeDefinition | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const share = serializeThemeShare(activeTheme);
    await navigator.clipboard.writeText(JSON.stringify(share, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [activeTheme]);

  const handlePreview = useCallback(() => {
    setError(null);
    setPreview(null);
    try {
      const share = parseThemeShare(pasted);
      setPreview(share.theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse theme JSON.");
    }
  }, [pasted]);

  const handleImport = useCallback(async () => {
    if (!preview) return;
    await db.createThemeDefinition(preview);
    setPasted("");
    setPreview(null);
    onThemesChange();
  }, [preview, onThemesChange]);

  const handleRemove = useCallback(
    async (id: string) => {
      await db.deleteThemeDefinition(id);
      onThemesChange();
    },
    [onThemesChange],
  );

  const importedThemes = themes.filter((theme) => !builtInIds.has(theme.id));

  return (
    <div className="module shared-modules-panel">
      <h3>Themes</h3>
      <div className="entry-actions">
        <button type="button" onClick={handleShare}>
          {copied ? "Copied!" : `Share "${activeTheme.name}"`}
        </button>
      </div>
      <p className="shared-modules-hint">Paste a theme JSON someone shared with you.</p>
      <textarea
        className="shared-modules-textarea"
        value={pasted}
        onChange={(event) => setPasted(event.target.value)}
        placeholder="Paste theme JSON here…"
        rows={4}
        aria-label="Paste shared theme JSON"
      />
      <div className="entry-actions">
        <button type="button" onClick={handlePreview} disabled={!pasted.trim()}>
          Preview
        </button>
        <button type="button" onClick={handleImport} disabled={!preview}>
          Import
        </button>
      </div>
      {error && <p className="import-error">{error}</p>}
      {preview && (
        <div className="shared-modules-preview">
          <p>
            <strong>{preview.name}</strong>
          </p>
        </div>
      )}
      {importedThemes.length > 0 && (
        <ul>
          {importedThemes.map((theme) => (
            <li key={theme.id}>
              {theme.name}{" "}
              <button type="button" onClick={() => handleRemove(theme.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
