import type { ModuleId } from "../modules/registry";

interface ModulePropertiesPanelProps {
  moduleId: ModuleId;
  content: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}

/**
 * Phase 6.3 ("light config"): a settings form per configurable moduleId,
 * switching the same way BoardModuleHost does. Only rendered for ids in
 * CONFIGURABLE_MODULE_IDS -- BoardCanvas decides that, this just assumes
 * it's already one of them.
 */
export function ModulePropertiesPanel({ moduleId, content, onChange, onClose }: ModulePropertiesPanelProps) {
  return (
    <div className="module-properties-panel">
      <div className="module-properties-panel-header">
        <span>Properties</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <ModulePropertiesFields moduleId={moduleId} content={content} onChange={onChange} />
    </div>
  );
}

function ModulePropertiesFields({
  moduleId,
  content,
  onChange,
}: {
  moduleId: ModuleId;
  content: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  switch (moduleId) {
    case "habit-streak": {
      const daysToShow = typeof content.daysToShow === "number" ? content.daysToShow : 30;
      return (
        <label className="module-properties-row">
          Days to show
          <select value={daysToShow} onChange={(event) => onChange({ daysToShow: Number(event.target.value) })}>
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={30}>30</option>
            <option value={90}>90</option>
          </select>
        </label>
      );
    }
    case "tag-frequency": {
      const limit = typeof content.limit === "number" ? content.limit : 10;
      return (
        <label className="module-properties-row">
          Number of tags
          <select value={limit} onChange={(event) => onChange({ limit: Number(event.target.value) })}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
      );
    }
    case "mood-vs-weather": {
      const view = content.view === "table" ? "table" : "chart";
      return (
        <label className="module-properties-row">
          Default view
          <select value={view} onChange={(event) => onChange({ view: event.target.value })}>
            <option value="chart">Chart</option>
            <option value="table">Table</option>
          </select>
        </label>
      );
    }
    default:
      return null;
  }
}
