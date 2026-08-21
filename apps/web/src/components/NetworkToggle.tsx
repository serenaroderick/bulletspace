import type { NetworkState } from "@bulletspace/core";

const OPTIONS: Array<{ value: NetworkState; label: string; icon: string }> = [
  { value: "local", label: "Local Purist", icon: "🔒" },
  { value: "connected", label: "Connected Citizen", icon: "🌐" },
  { value: "ai", label: "AI Enhanced", icon: "🧠" },
];

interface NetworkToggleProps {
  state: NetworkState;
  onChange: (state: NetworkState) => void;
}

export function NetworkToggle({ state, onChange }: NetworkToggleProps) {
  return (
    <div className="network-toggle" role="radiogroup" aria-label="Network access mode">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={state === option.value}
          className={state === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
          title={option.label}
        >
          <span aria-hidden="true">{option.icon}</span> {option.label}
        </button>
      ))}
    </div>
  );
}
