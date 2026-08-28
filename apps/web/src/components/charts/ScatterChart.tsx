const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 32;

interface ScatterChartProps {
  rows: Record<string, unknown>[];
  xField: string;
  yField: string;
}

export function ScatterChart({ rows, xField, yField }: ScatterChartProps) {
  const points = rows
    .map((row) => ({ x: Number(row[xField]), y: Number(row[yField]), label: row }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (points.length === 0) {
    return <p className="empty">No data to chart.</p>;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = Math.max(1e-6, maxX - minX);
  const ySpan = Math.max(1e-6, maxY - minY);

  const coords = points.map((point) => ({
    cx: PADDING + ((point.x - minX) / xSpan) * (WIDTH - PADDING * 2),
    cy: HEIGHT - PADDING - ((point.y - minY) / ySpan) * (HEIGHT - PADDING * 2),
    tooltip: `${xField}: ${point.x}, ${yField}: ${point.y}`,
  }));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: "100%", maxWidth: WIDTH, height: "auto", display: "block" }}
      role="img"
      aria-label={`Scatter chart of ${yField} vs ${xField}`}
    >
      <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="var(--bs-color-border)" />
      <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} stroke="var(--bs-color-border)" />
      {coords.map((coord, i) => (
        <circle key={i} cx={coord.cx} cy={coord.cy} r={4} fill="var(--bs-color-accent)" fillOpacity={0.7}>
          <title>{coord.tooltip}</title>
        </circle>
      ))}
    </svg>
  );
}
