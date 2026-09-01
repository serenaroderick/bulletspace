import { isTauri } from "../lib/platform";
import { MODULE_REGISTRY_LIST, type ModuleRegistryEntry } from "../modules/registry";

interface ModulePickerProps {
  onPick: (module: ModuleRegistryEntry) => void;
  onClose: () => void;
}

export function ModulePicker({ onPick, onClose }: ModulePickerProps) {
  const modules = MODULE_REGISTRY_LIST.filter((module) => !module.requiresTauri || isTauri());

  return (
    <div className="module-picker">
      <div className="module-picker-header">
        <span>Modules</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="module-picker-list">
        {modules.map((module) => (
          <button key={module.id} type="button" className="module-picker-item" onClick={() => onPick(module)}>
            {module.label}
          </button>
        ))}
      </div>
    </div>
  );
}
