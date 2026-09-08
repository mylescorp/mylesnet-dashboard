"use client";

interface IndicatorGaugeProps {
  value: number;
  max?: number;
  warnAt?: number;
  dangerAt?: number;
  tone?: "ok" | "warn" | "danger";
  unit?: string;
  size?: number;
  label?: string;
}

function toneFor(value: number, warnAt: number | undefined, dangerAt: number | undefined): "ok" | "warn" | "danger" {
  if (dangerAt !== undefined && value >= dangerAt) return "danger";
  if (warnAt !== undefined && value >= warnAt) return "warn";
  return "ok";
}

/**
 * Compact semicircular gauge rendered with inline SVG (no chart dependency).
 * The value is shown in the centre; the arc fills left-to-right and shifts
 * success → warning → danger as it crosses the supplied thresholds. Pass an
 * explicit `tone` when the "good" direction is inverted (e.g. health/revenue,
 * where rising values are good).
 */
export default function IndicatorGauge({ value, max = 100, warnAt, dangerAt, tone, unit = "%", size = 88, label }: IndicatorGaugeProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.max(0, Math.min(safeMax, value));
  const percent = max > 0 ? Math.min(100, (clamped / max) * 100) : 0;
  const resolvedTone = tone ?? toneFor(percent, warnAt, dangerAt);

  const width = size;
  const height = Math.round(size * 0.62);
  const stroke = Math.max(7, Math.round(size / 11));
  const radius = (width - stroke * 2.5) / 2;
  const cx = width / 2;
  const cy = height - stroke;

  const color = resolvedTone === "danger" ? "var(--danger)" : resolvedTone === "warn" ? "var(--warning)" : "var(--success)";
  const shownValue = max > 0 ? Math.round((value / max) * 100) : 0;
  const arcLength = Math.PI * radius;
  const dashOffset = arcLength * (1 - percent / 100);

  const path = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <div className="indicator-gauge" role="img" aria-label={`${label ?? "Indicator"}: ${shownValue}${unit}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path d={path} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
        />
        <text
          x={cx}
          y={cy - stroke * 0.7}
          textAnchor="middle"
          fill="currentColor"
          style={{ font: `700 ${Math.round(size / 5.2)}px var(--font-sans)`, letterSpacing: "-0.02em" }}
        >
          {shownValue}
          <tspan style={{ font: `700 ${Math.round(size / 9)}px var(--font-sans)`, opacity: 0.55 }}>{unit}</tspan>
        </text>
      </svg>
    </div>
  );
}