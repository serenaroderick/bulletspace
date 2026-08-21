import type { Entry } from "@bulletspace/core";

const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 24;
const RATING_MIN = 1;
const RATING_MAX = 10;

interface EnergyFocusChartProps {
  entries: Entry[];
}

export function EnergyFocusChart({ entries }: EnergyFocusChartProps) {
  const points = entries
    .filter((entry) => entry.energy !== null || entry.focus !== null)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (points.length === 0) {
    return (
      <div className="module">
        <h3>Energy &amp; Focus</h3>
        <p className="empty">No energy/focus ratings logged yet.</p>
      </div>
    );
  }

  const minTime = points[0].createdAt;
  const maxTime = points[points.length - 1].createdAt;
  const timeSpan = Math.max(1, maxTime - minTime);

  const toX = (createdAt: number) => PADDING + ((createdAt - minTime) / timeSpan) * (WIDTH - PADDING * 2);
  const toY = (value: number) =>
    HEIGHT - PADDING - ((value - RATING_MIN) / (RATING_MAX - RATING_MIN)) * (HEIGHT - PADDING * 2);

  const energyPoints = points.filter((entry): entry is Entry & { energy: number } => entry.energy !== null);
  const focusPoints = points.filter((entry): entry is Entry & { focus: number } => entry.focus !== null);

  const energyLine = energyPoints.map((entry) => `${toX(entry.createdAt)},${toY(entry.energy)}`).join(" ");
  const focusLine = focusPoints.map((entry) => `${toX(entry.createdAt)},${toY(entry.focus)}`).join(" ");

  return (
    <div className="module">
      <h3>Energy &amp; Focus</h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", maxWidth: WIDTH, height: "auto", display: "block" }}
        role="img"
        aria-label="Energy and focus over time line chart"
      >
        {energyPoints.length > 0 && <polyline points={energyLine} fill="none" stroke="#f5a623" strokeWidth={2} />}
        {focusPoints.length > 0 && <polyline points={focusLine} fill="none" stroke="#4fbf6b" strokeWidth={2} />}
      </svg>
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "#f5a623" }} /> Energy
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "#4fbf6b" }} /> Focus
        </span>
      </div>
    </div>
  );
}
