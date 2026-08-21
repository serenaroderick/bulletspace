import { applyTransformation, type DataPayload, type ModuleOutput } from "@bulletspace/core";
import { useMemo, useState } from "react";
import { BarChart } from "./charts/BarChart";
import { ScatterChart } from "./charts/ScatterChart";

interface ModuleOutputRendererProps {
  output: ModuleOutput;
  payload: DataPayload;
}

export function ModuleOutputRenderer({ output, payload }: ModuleOutputRendererProps) {
  if (payload.rows.length === 0) {
    return <p className="empty">No data yet.</p>;
  }

  if (output.type === "chart") {
    const chartType = output.config.chartType as string | undefined;
    const x = output.config.x as string | undefined;
    const y = output.config.y as string | undefined;
    if (!x || !y) return <p className="empty">Chart output is missing x/y field config.</p>;

    if (chartType === "bar") return <BarChart rows={payload.rows} xField={x} yField={y} />;
    if (chartType === "scatter") return <ScatterChart rows={payload.rows} xField={x} yField={y} />;
    return <p className="empty">Unsupported chart type: {chartType}</p>;
  }

  return <ReactiveTable payload={payload} />;
}

/**
 * "Reactive" in the sense the Phase 2 checklist means: clicking a column
 * header re-sorts using the same `applyTransformation` sort transformation
 * the query engine itself runs, not a bespoke client-side sort -- so the
 * displayed order is always something the pipeline could produce.
 */
function ReactiveTable({ payload }: { payload: DataPayload }) {
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return payload.rows;
    return applyTransformation(payload, { kind: "sort", ...sort }).rows;
  }, [payload, sort]);

  const toggleSort = (field: string) => {
    setSort((current) => {
      if (!current || current.field !== field) return { field, direction: "asc" };
      if (current.direction === "asc") return { field, direction: "desc" };
      return null;
    });
  };

  const fieldIds = payload.fields.map((field) => field.id);

  return (
    <table className="merge-table">
      <thead>
        <tr>
          {fieldIds.map((id) => (
            <th key={id}>
              <button type="button" className="sortable-header" onClick={() => toggleSort(id)}>
                {id}
                {sort?.field === id ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {fieldIds.map((id) => (
              <td key={id}>{String(row[id] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
