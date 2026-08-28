import type { ThemeDefinition } from "@bulletspace/core";
import type { ChangeEvent } from "react";

interface ThemeSwitcherProps {
  themes: ThemeDefinition[];
  activeThemeId: string;
  onChange: (theme: ThemeDefinition) => void;
}

export function ThemeSwitcher({ themes, activeThemeId, onChange }: ThemeSwitcherProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const theme = themes.find((candidate) => candidate.id === event.target.value);
    if (theme) onChange(theme);
  };

  return (
    <select className="theme-switcher" aria-label="Theme" value={activeThemeId} onChange={handleChange}>
      {themes.map((theme) => (
        <option key={theme.id} value={theme.id}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
