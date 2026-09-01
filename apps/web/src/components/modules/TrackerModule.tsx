import { useState } from "react";

export interface TrackerColumn {
  id: string;
  title: string;
}

export interface TrackerRow {
  id: string;
  label: string;
}

export type TrackerChecked = Record<string, Record<string, boolean>>;

function newId(): string {
  return crypto.randomUUID();
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

  const addColumn = () => {
    const next = [...columns, { id: newId(), title: "" }];
    setColumns(next);
    onConfigChange({ columns: next });
  };

  const renameColumn = (id: string, title: string) => {
    const next = columns.map((col) => (col.id === id ? { ...col, title } : col));
    setColumns(next);
    onConfigChange({ columns: next });
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
        <thead>
          <tr>
            <th className="tracker-corner" />
            {columns.map((col) => (
              <th key={col.id}>
                <div className="tracker-header-cell">
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
