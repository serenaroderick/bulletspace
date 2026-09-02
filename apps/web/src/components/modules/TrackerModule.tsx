import { type DragEvent, type MouseEvent as ReactMouseEvent, useRef, useState } from "react";

export interface TrackerColumn {
  id: string;
  title: string;
  /** px. Defaults to DEFAULT_COLUMN_WIDTH when unset (columns created before resizing existed). */
  width?: number;
}

export interface TrackerRow {
  id: string;
  label: string;
}

export type TrackerChecked = Record<string, Record<string, boolean>>;

function newId(): string {
  return crypto.randomUUID();
}

const DEFAULT_COLUMN_WIDTH = 100;
const ROW_LABEL_COLUMN_WIDTH = 130;
const ADD_COLUMN_WIDTH = 32;
// Floor for a column with no real content yet (e.g. still showing the
// "Habit name" placeholder) -- there's no real word to measure a floor
// from, so fall back to something narrow but usable rather than 0.
const EMPTY_COLUMN_MIN_WIDTH = 48;
// Matches .tracker-table's font-size (0.85rem) closely enough for a
// minimum-width floor -- this only needs to be a reasonable estimate,
// not pixel-perfect, since overestimating just means the floor is a
// touch more generous, never text getting clipped.
const MEASURE_FONT = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string): number {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = MEASURE_FONT;
  return ctx.measureText(text).width;
}

/**
 * The floor a column can be resized down to -- the width of its longest
 * single word (titles live in a single-line `<input>`, which already
 * clips/scrolls its own overflow rather than ever bleeding into a
 * neighboring cell, so this isn't preventing visual overlap so much as
 * preventing a resize so aggressive the label becomes illegible).
 */
function minColumnWidth(title: string): number {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return EMPTY_COLUMN_MIN_WIDTH;
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  return Math.ceil(measureTextWidth(longest)) + 24; // padding for the delete "x" and cell padding
}

interface TrackerModuleProps {
  columns?: TrackerColumn[];
  rows?: TrackerRow[];
  checked?: TrackerChecked;
  onConfigChange: (patch: {
    columns?: TrackerColumn[];
    rows?: TrackerRow[];
    checked?: TrackerChecked;
  }) => void;
}

/**
 * A spreadsheet-style checkbox matrix -- columns are habits ("gym"), rows
 * are dates, cells are checkboxes. Fully inline-editable (like Excel),
 * so there's no separate properties panel the way Habit Streak/Tag
 * Frequency/Mood vs. Weather have one -- editing the grid IS the module,
 * the same way JournalModule's form is inline rather than a side panel.
 *
 * State is seeded once from `content` on mount and not re-synced from
 * props afterward (same pattern WeatherModule already uses for its own
 * config/payload state) -- every edit updates local state immediately
 * for instant typing, and fires onConfigChange in the background to
 * persist. Fine for a single-user local-first app with one writer; not
 * built to handle concurrent editors.
 */
export function TrackerModule({
  columns: initialColumns = [],
  rows: initialRows = [],
  checked: initialChecked = {},
  onConfigChange,
}: TrackerModuleProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [rows, setRows] = useState(initialRows);
  const [checked, setChecked] = useState(initialChecked);
  // Which column is mid-drag, for the reorder-by-dragging-the-handle
  // interaction below -- a plain ref rather than state since it's only
  // read inside drag event handlers, never rendered.
  const draggedColumnId = useRef<string | null>(null);

  const addColumn = () => {
    const next = [...columns, { id: newId(), title: "", width: DEFAULT_COLUMN_WIDTH }];
    setColumns(next);
    onConfigChange({ columns: next });
  };

  const renameColumn = (id: string, title: string) => {
    const next = columns.map((col) => (col.id === id ? { ...col, title } : col));
    setColumns(next);
    onConfigChange({ columns: next });
  };

  const handleColumnDragStart = (id: string) => (event: DragEvent<HTMLButtonElement>) => {
    draggedColumnId.current = id;
    event.dataTransfer.effectAllowed = "move";
  };

  const handleColumnDragOver = (event: DragEvent<HTMLTableCellElement>) => {
    if (draggedColumnId.current) event.preventDefault();
  };

  const handleColumnDrop = (targetId: string) => (event: DragEvent<HTMLTableCellElement>) => {
    event.preventDefault();
    const sourceId = draggedColumnId.current;
    draggedColumnId.current = null;
    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = columns.findIndex((col) => col.id === sourceId);
    const targetIndex = columns.findIndex((col) => col.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = [...columns];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setColumns(next);
    onConfigChange({ columns: next });
  };

  // Resize drag: tracked via plain window listeners (not React's onMouseMove)
  // since the pointer routinely moves off the thin handle element itself
  // mid-drag. Live width updates go straight to local state for immediate
  // visual feedback; onConfigChange only fires once, on mouseup -- a resize
  // drag fires far more events per pixel than typing ever does, so
  // persisting every intermediate frame the way text edits do would be
  // needless churn.
  const handleResizeStart = (col: TrackerColumn) => (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = col.width ?? DEFAULT_COLUMN_WIDTH;
    const floor = minColumnWidth(col.title);
    let latestWidth = startWidth;

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      latestWidth = Math.max(floor, startWidth + (moveEvent.clientX - startX));
      setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, width: latestWidth } : c)));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setColumns((prev) => {
        const next = prev.map((c) => (c.id === col.id ? { ...c, width: latestWidth } : c));
        onConfigChange({ columns: next });
        return next;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const deleteColumn = (id: string) => {
    const nextColumns = columns.filter((col) => col.id !== id);
    const nextChecked: TrackerChecked = {};
    for (const [rowId, byCol] of Object.entries(checked)) {
      const { [id]: _removed, ...rest } = byCol;
      nextChecked[rowId] = rest;
    }
    setColumns(nextColumns);
    setChecked(nextChecked);
    onConfigChange({ columns: nextColumns, checked: nextChecked });
  };

  const addRow = () => {
    const next = [...rows, { id: newId(), label: new Date().toLocaleDateString() }];
    setRows(next);
    onConfigChange({ rows: next });
  };

  const renameRow = (id: string, label: string) => {
    const next = rows.map((row) => (row.id === id ? { ...row, label } : row));
    setRows(next);
    onConfigChange({ rows: next });
  };

  const deleteRow = (id: string) => {
    const nextRows = rows.filter((row) => row.id !== id);
    const { [id]: _removed, ...nextChecked } = checked;
    setRows(nextRows);
    setChecked(nextChecked);
    onConfigChange({ rows: nextRows, checked: nextChecked });
  };

  const toggleCell = (rowId: string, colId: string) => {
    const next = { ...checked, [rowId]: { ...checked[rowId], [colId]: !checked[rowId]?.[colId] } };
    setChecked(next);
    onConfigChange({ checked: next });
  };

  return (
    <div className="module">
      <h3>Tracker</h3>
      <table className="tracker-table">
        <colgroup>
          <col style={{ width: ROW_LABEL_COLUMN_WIDTH }} />
          {columns.map((col) => (
            <col key={col.id} style={{ width: col.width ?? DEFAULT_COLUMN_WIDTH }} />
          ))}
          <col style={{ width: ADD_COLUMN_WIDTH }} />
        </colgroup>
        <thead>
          <tr>
            <th className="tracker-corner" />
            {columns.map((col) => (
              <th key={col.id} onDragOver={handleColumnDragOver} onDrop={handleColumnDrop(col.id)}>
                <div className="tracker-header-cell">
                  <button
                    type="button"
                    className="tracker-handle"
                    aria-label="Drag to reorder column"
                    draggable
                    onDragStart={handleColumnDragStart(col.id)}
                  >
                    ⠿
                  </button>
                  <input
                    className="tracker-header-input"
                    value={col.title}
                    placeholder="Habit name"
                    aria-label="Column title"
                    onChange={(event) => renameColumn(col.id, event.target.value)}
                  />
                  <button type="button" className="tracker-delete" aria-label="Delete column" onClick={() => deleteColumn(col.id)}>
                    ×
                  </button>
                </div>
                {/* biome-ignore lint: not a real button -- a drag surface on the column's edge, matching the column-resize convention every spreadsheet uses */}
                <div
                  className="tracker-resize-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${col.title || "column"}`}
                  onMouseDown={handleResizeStart(col)}
                />
              </th>
            ))}
            <th>
              <button type="button" className="tracker-add" aria-label="Add column" onClick={addColumn}>
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th>
                <div className="tracker-header-cell">
                  <input
                    className="tracker-header-input"
                    value={row.label}
                    aria-label="Row label"
                    onChange={(event) => renameRow(row.id, event.target.value)}
                  />
                  <button type="button" className="tracker-delete" aria-label="Delete row" onClick={() => deleteRow(row.id)}>
                    ×
                  </button>
                </div>
              </th>
              {columns.map((col) => (
                <td key={col.id} className="tracker-cell">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[row.id]?.[col.id])}
                    onChange={() => toggleCell(row.id, col.id)}
                    aria-label={`${col.title || "column"} on ${row.label}`}
                  />
                </td>
              ))}
              <td />
            </tr>
          ))}
          <tr>
            <th>
              <button type="button" className="tracker-add" aria-label="Add row" onClick={addRow}>
                +
              </button>
            </th>
            {columns.map((col) => (
              <td key={col.id} />
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
