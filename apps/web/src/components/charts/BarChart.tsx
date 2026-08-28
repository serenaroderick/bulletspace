const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 32;

interface BarChartProps {
  rows: Record<string, unknown>[];
  xField: string;
  yField: string;
}

export function BarChart({ rows, xField, yField }: BarChartProps) {
  if (rows.length === 0) {
    return <p className="empty">No data to chart.</p>;
  }

  const values = rows.map((row) => Number(row[yField]) || 0);
  const maxValue = Math.max(...values, 1);
  const barWidth = (WIDTH - PADDING * 2) / rows.length;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: "100%", maxWidth: WIDTH, height: "auto", display: "block" }}
      role="img"
      aria-label={`Bar chart of ${yField} by ${xField}`}
    >
      {rows.map((row, i) => {
        const value = Number(row[yField]) || 0;
        const barHeight = maxValue > 0 ? (value / maxValue) * (HEIGHT - PADDING * 2) : 0;
        const x = PADDING + i * barWidth;
        const y = HEIGHT - PADDING - barHeight;
        return (
          <rect
            key={`${String(row[xField])}-${i}`}
            x={x + 2}
            y={y}
            width={Math.max(1, barWidth - 4)}
            height={barHeight}
            fill="var(--bs-color-accent)"
          >
            <title>{`${String(row[xField])}: ${value}`}</title>
          </rect>
        );
      })}
      <line
        x1={PADDING}
        y1={HEIGHT - PADDING}
        x2={WIDTH - PADDING}
        y2={HEIGHT - PADDING}
        stroke="var(--bs-color-border)"
      />
    </svg>
  );
}
