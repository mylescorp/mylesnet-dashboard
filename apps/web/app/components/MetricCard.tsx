import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  tone?: "accent" | "primary" | "success" | "warning" | "danger" | "neutral";
}

export default function MetricCard({ icon: Icon, label, value, detail, tone = "primary" }: MetricCardProps) {
  return (
    <div className={`metric-card metric-card-${tone}`}>
      <span className="metric-icon">
        <Icon aria-hidden="true" size={19} />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}