import type { ReactNode } from "react";
import { cn } from "../utils";

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "metric" | "selectable" | "critical" | "empty";
  selected?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Card({ title, subtitle, eyebrow, actions, children, footer, variant = "default", selected, className, bodyClassName }: CardProps) {
  return (
    <section className={cn("workspace-card card", variant === "metric" && "card-metric", variant === "selectable" && "card-selectable", variant === "critical" && "card-critical", variant === "empty" && "card-empty", selected && "card-selected", className)}>
      {title != null || actions != null ? (
        <header className="card-header">
          <div className="card-header-text">
            {eyebrow != null ? <p className="eyebrow">{eyebrow}</p> : null}
            {title != null ? <h2 className="card-title">{title}</h2> : null}
            {subtitle != null ? <p className="card-subtitle">{subtitle}</p> : null}
          </div>
          {actions != null ? <div className="card-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("card-body", bodyClassName)}>{children}</div>
      {footer != null ? <footer className="card-footer">{footer}</footer> : null}
    </section>
  );
}

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "up" | "down" | "flat";
  icon?: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, delta, deltaTone, icon, hint, className }: MetricCardProps) {
  return (
    <section className={cn("card card-metric", className)}>
      <div className="card-metric-header">
        {icon != null ? <span className="card-metric-icon" aria-hidden="true">{icon}</span> : null}
        <p className="card-metric-label">{label}</p>
      </div>
      <div className="card-metric-value">{value}</div>
      {delta != null ? (
        <div className={cn("card-metric-delta", deltaTone && `card-metric-delta-${deltaTone}`)}>
          {delta}
        </div>
      ) : null}
      {hint != null ? <p className="card-metric-hint">{hint}</p> : null}
    </section>
  );
}