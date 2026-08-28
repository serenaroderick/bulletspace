import type { Entry } from "@bulletspace/core";

const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 24;
const MOOD_MIN = 1;
const MOOD_MAX = 10;

interface MoodLineChartProps {
  entries: Entry[];
}

export function MoodLineChart({ entries }: MoodLineChartProps) {
  const points = entries
    .filter((entry): entry is Entry & { mood: number } => entry.mood !== null)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (points.length === 0) {
    return (
      <div className="module">
        <h3>Mood over time</h3>
        <p className="empty">No mood ratings logged yet.</p>
      </div>
    );
  }

  const minTime = points[0].createdAt;
  const maxTime = points[points.length - 1].createdAt;
  const timeSpan = Math.max(1, maxTime - minTime);

  const coords = points.map((entry) => ({
    x: PADDING + ((entry.createdAt - minTime) / timeSpan) * (WIDTH - PADDING * 2),
    y:
      HEIGHT -
      PADDING -
      ((entry.mood - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)) * (HEIGHT - PADDING * 2),
  }));

  return (
    <div className="module">
      <h3>Mood over time</h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", maxWidth: WIDTH, height: "auto", display: "block" }}
        role="img"
        aria-label="Mood over time line chart"
      >
        <polyline
          points={coords.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="var(--bs-color-accent)"
          strokeWidth={2}
        />
        {coords.map((point, i) => (
          <circle key={points[i].id} cx={point.x} cy={point.y} r={3} fill="var(--bs-color-accent)" />
        ))}
      </svg>
    </div>
  );
}
