"use client";

interface KpiProps {
  label: string;
  value: string | number | React.ReactNode;
  detail: string;
  icon: React.ReactNode;
  tone?: "ok" | "warn" | "danger" | "neutral";
  className?: string;
}

export default function Kpi({ label, value, detail, icon, tone = "neutral", className }: KpiProps) {
  const toneClass = tone !== "neutral" ? ` operations-kpi-${tone}` : "";
  return (
    <article className={`operations-kpi${toneClass}${className ? ` ${className}` : ""}`}>
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}