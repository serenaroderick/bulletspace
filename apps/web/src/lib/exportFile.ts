import type { Entry, Journal } from "@bulletspace/core";
import { serializeJournalExport } from "./importExport";
import { isTauri } from "./platform";

function defaultFileName(journal: Journal): string {
  return `${journal.title.replace(/\s+/g, "-").toLowerCase()}-export.json`;
}

/**
 * The browser `<a download>` + blob-URL trick used on web doesn't reliably
 * produce a save dialog inside Tauri's webview (WKWebView on macOS) --
 * confirmed live: the click "fires" with no visible effect. Desktop needs
 * the real native dialog + filesystem write plugins instead.
 */
async function exportOnDesktop(journal: Journal, entries: Entry[]): Promise<void> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");

  const path = await save({
    defaultPath: defaultFileName(journal),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return;

  await writeTextFile(path, JSON.stringify(serializeJournalExport(journal, entries), null, 2));
}

function exportOnWeb(journal: Journal, entries: Entry[]): void {
  const blob = new Blob([JSON.stringify(serializeJournalExport(journal, entries), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultFileName(journal);
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportJournal(journal: Journal, entries: Entry[]): Promise<void> {
  if (isTauri()) {
    await exportOnDesktop(journal, entries);
  } else {
    exportOnWeb(journal, entries);
  }
}
