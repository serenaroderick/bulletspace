import {
  type DataPayload,
  type ModuleDefinition,
  type ModuleOutputType,
  type ModuleSource,
  type ModuleType,
  type Transformation,
  serializeModuleShare,
} from "@bulletspace/core";
import { useEffect, useState } from "react";
import { adapterRegistry, listKnownAdapters } from "../adapters/registry";
import { runModule } from "../lib/runModule";
import { useBoardContext } from "./BoardContext";
import { ModuleOutputRenderer } from "./ModuleOutputRenderer";

interface CustomModuleBuilderPanelProps {
  moduleDef: ModuleDefinition;
  onChange: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}

function fieldHint(adapterId: string): string {
  const fields = adapterRegistry[adapterId]?.fields;
  return fields && fields.length > 0 ? fields.map((f) => f.id).join(", ") : "";
}

/**
 * The real thing Phase 6.3 originally wanted, scoped down at the time to
 * "light config" because only Mood vs. Weather was ModuleDefinition-backed.
 * This panel is what lets a Custom Module element actually become one --
 * pick a source (or two + a join), add filters/formulas, pick a chart
 * type, see it live. Every field commits immediately via onChange, same
 * "no Apply button" convention every other panel in this app follows.
 *
 * Keeps its own local `draft` state seeded once from the incoming
 * moduleDef (same reasoning as TrackerModule: instant typing, no
 * round-trip lag through the async persistence path) -- BoardCanvas MUST
 * render this with `key={element.id}` so switching the selected custom
 * module actually re-seeds the draft instead of showing stale state.
 */
export function CustomModuleBuilderPanel({ moduleDef, onChange, onClose }: CustomModuleBuilderPanelProps) {
  const { entries } = useBoardContext();
  const [draft, setDraft] = useState(moduleDef);
  const [previewPayload, setPreviewPayload] = useState<DataPayload | null>(null);
  const [missingAdapterIds, setMissingAdapterIds] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await runModule(draft, entries);
        if (cancelled) return;
        setPreviewError(null);
        setPreviewPayload(result.payload);
        setMissingAdapterIds(result.missingAdapterIds);
      } catch (err) {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : "Invalid configuration.");
        setPreviewPayload(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, entries]);

  const commit = (patch: Partial<ModuleDefinition>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange({ moduleDef: next });
  };

  const setType = (type: ModuleType) => {
    let sources = draft.sources;
    if (type === "single") {
      sources = sources.slice(0, 1);
    } else if (sources.length < 2) {
      sources = [...sources, ...Array.from({ length: 2 - sources.length }, () => ({ adapterId: "", alias: "" }))];
    }
    commit({ type, sources, joinOn: type === "merge" ? (draft.joinOn ?? "") : undefined });
  };

  const updateSource = (index: number, patch: Partial<ModuleSource>) => {
    const sources = draft.sources.map((source, i) => (i === index ? { ...source, ...patch } : source));
    commit({ sources });
  };

  const addTransformation = (kind: Transformation["kind"]) => {
    const blank: Transformation =
      kind === "filter"
        ? { kind: "filter", expression: "" }
        : kind === "formula"
          ? { kind: "formula", expression: "" }
          : kind === "sort"
            ? { kind: "sort", field: "", direction: "asc" }
            : { kind: "group", field: "" };
    commit({ transformations: [...draft.transformations, blank] });
  };

  const updateTransformation = (index: number, next: Transformation) => {
    commit({ transformations: draft.transformations.map((t, i) => (i === index ? next : t)) });
  };

  const removeTransformation = (index: number) => {
    commit({ transformations: draft.transformations.filter((_, i) => i !== index) });
  };

  const setOutputType = (type: ModuleOutputType) => {
    commit({ output: { ...draft.output, type } });
  };

  const setOutputConfig = (patch: Record<string, unknown>) => {
    commit({ output: { ...draft.output, config: { ...draft.output.config, ...patch } } });
  };

  const handleShare = async () => {
    const share = serializeModuleShare(draft, listKnownAdapters());
    await navigator.clipboard.writeText(JSON.stringify(share, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sourceHint = draft.sources
    .map((s) => s.adapterId)
    .filter(Boolean)
    .map(fieldHint)
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="module-builder-panel">
      <div className="module-properties-panel-header">
        <span>Custom Module</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="module-builder-row">
        Name
        <input value={draft.name} onChange={(event) => commit({ name: event.target.value })} />
      </label>

      <label className="module-builder-row">
        Type
        <select value={draft.type} onChange={(event) => setType(event.target.value as ModuleType)}>
          <option value="single">Single source</option>
          <option value="merge">Merge two sources</option>
        </select>
      </label>

      {draft.sources.map((source, index) => (
        <div className="module-builder-source-row" key={index}>
          <select
            value={source.adapterId}
            onChange={(event) => {
              const adapterId = event.target.value;
              updateSource(index, { adapterId, alias: source.alias || adapterId });
            }}
          >
            <option value="">Select adapter…</option>
            {listKnownAdapters().map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.name}
              </option>
            ))}
          </select>
          <input
            className="module-builder-alias-input"
            value={source.alias}
            placeholder="alias"
            aria-label="Source alias"
            onChange={(event) => updateSource(index, { alias: event.target.value })}
          />
        </div>
      ))}
      {draft.type === "merge" && (
        <label className="module-builder-row">
          Join on
          <input value={draft.joinOn ?? ""} onChange={(event) => commit({ joinOn: event.target.value })} placeholder="date" />
        </label>
      )}
      {sourceHint && <p className="module-builder-hint">Available fields: {sourceHint}</p>}

      <div className="module-builder-section">
        <div className="module-builder-section-header">
          <span>Transformations</span>
        </div>
        {draft.transformations.map((t, index) => (
          <div className="module-builder-transformation-row" key={index}>
            <span className="module-builder-kind">{t.kind}</span>
            {(t.kind === "filter" || t.kind === "formula") && (
              <input
                value={t.expression}
                placeholder={t.kind === "filter" ? "field > value" : "target = a + b"}
                onChange={(event) => updateTransformation(index, { ...t, expression: event.target.value })}
              />
            )}
            {(t.kind === "sort" || t.kind === "group") && (
              <input
                value={t.field}
                placeholder="field"
                onChange={(event) => updateTransformation(index, { ...t, field: event.target.value })}
              />
            )}
            {t.kind === "sort" && (
              <select
                value={t.direction}
                onChange={(event) => updateTransformation(index, { ...t, direction: event.target.value as "asc" | "desc" })}
              >
                <option value="asc">asc</option>
                <option value="desc">desc</option>
              </select>
            )}
            <button type="button" className="tracker-delete" aria-label="Remove" onClick={() => removeTransformation(index)}>
              ×
            </button>
          </div>
        ))}
        <div className="module-builder-add-row">
          <button type="button" onClick={() => addTransformation("filter")}>
            + Filter
          </button>
          <button type="button" onClick={() => addTransformation("formula")}>
            + Formula
          </button>
          <button type="button" onClick={() => addTransformation("sort")}>
            + Sort
          </button>
          <button type="button" onClick={() => addTransformation("group")}>
            + Group
          </button>
        </div>
      </div>

      <label className="module-builder-row">
        Output
        <select value={draft.output.type} onChange={(event) => setOutputType(event.target.value as ModuleOutputType)}>
          <option value="table">Table</option>
          <option value="chart">Chart</option>
        </select>
      </label>
      {draft.output.type === "chart" && (
        <>
          <label className="module-builder-row">
            Chart type
            <select
              value={String(draft.output.config.chartType ?? "bar")}
              onChange={(event) => setOutputConfig({ chartType: event.target.value })}
            >
              <option value="bar">Bar</option>
              <option value="scatter">Scatter</option>
            </select>
          </label>
          <label className="module-builder-row">
            X field
            <input value={String(draft.output.config.x ?? "")} onChange={(event) => setOutputConfig({ x: event.target.value })} />
          </label>
          <label className="module-builder-row">
            Y field
            <input value={String(draft.output.config.y ?? "")} onChange={(event) => setOutputConfig({ y: event.target.value })} />
          </label>
        </>
      )}

      <button type="button" onClick={handleShare}>
        {copied ? "Copied!" : "Share"}
      </button>

      <div className="module-builder-preview">
        <div className="module-builder-section-header">
          <span>Preview</span>
        </div>
        {previewError && <p className="import-error">{previewError}</p>}
        {!previewError && missingAdapterIds.length > 0 && (
          <p className="empty">
            Needs data from: {missingAdapterIds.map((id) => adapterRegistry[id]?.name ?? id).join(", ")}.
          </p>
        )}
        {!previewError && previewPayload && previewPayload.rows.length === 0 && missingAdapterIds.length === 0 && (
          <p className="empty">No data yet.</p>
        )}
        {!previewError && previewPayload && previewPayload.rows.length > 0 && (
          <ModuleOutputRenderer output={draft.output} payload={previewPayload} />
        )}
      </div>
    </div>
  );
}
