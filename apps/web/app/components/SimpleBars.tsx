interface SimpleBarsProps {
  data: { label: string; value: number }[];
  formatTick?: (value: number) => string;
  tone?: "primary" | "success" | "warning";
}

export default function SimpleBars({ data, formatTick, tone = "primary" }: SimpleBarsProps) {
  const width = 720;
  const height = 150;
  const pad = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = data.length > 0 ? (width - pad * (data.length + 1)) / data.length : 0;
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="chart-bars" aria-label="Trend chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" style={{ width: "100%", height: "auto" }}>
        {data.map((d, i) => {
          const x = pad + i * (barW + pad) + pad / 2;
          return (
            <text key={`label-${i}`} x={x + barW / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {i % labelEvery === 0 ? d.label : ""}
            </text>
          );
        })}
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * (height - 24));
          const x = pad + i * (barW + pad) + pad / 2;
          return (
            <rect key={`bar-${i}`} x={x} y={height - h - 14} width={barW} height={h} rx={3} fill={`var(--${tone})`} opacity={0.85}>
              <title>{`${d.label}: ${formatTick ? formatTick(d.value) : d.value}`}</title>
            </rect>
          );
        })}
        <line x1={0} y1={height - 14} x2={width} y2={height - 14} stroke="var(--line)" strokeWidth={1} />
      </svg>
    </div>
  );
}
