import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

export function StatCard({ label, value, caption, breakdown }: { label: string; value: ReactNode; caption?: ReactNode; breakdown?: ReactNode }) {
  return <section className="mn-stat-card"><p className="mn-eyebrow">{label}</p><div className="mn-stat-value">{value}</div>{caption != null ? <p className="mn-stat-caption">{caption}</p> : null}{breakdown != null ? <div className="mn-stat-breakdown">{breakdown}</div> : null}</section>;
}

export function InsetPanel({ title, actions, children, className = "" }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`mn-inset-panel ${className}`}><header className="mn-inset-header"><h2>{title}</h2>{actions}</header>{children}</section>;
}

export interface ActivityItem {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  timestamp: ReactNode;
  href?: string;
}

export function ActivityList({ items, label }: { items: ActivityItem[]; label: string }) {
  return <ol className="mn-activity-list" aria-label={label} aria-live="polite">{items.map((item) => <li key={item.id}>
    <span className="mn-activity-icon" aria-hidden="true">{item.icon}</span>
    <span className="mn-activity-copy">{item.href ? <a href={item.href}>{item.title}</a> : <strong>{item.title}</strong>}{item.detail != null ? <small>{item.detail}</small> : null}</span>
    <time className="mn-activity-time">{item.timestamp}</time>
  </li>)}</ol>;
}

export function ActionCard({ icon, title, description, href }: { icon: ReactNode; title: ReactNode; description: ReactNode; href: string }) {
  return <a className="mn-action-card" href={href}><span className="mn-action-icon" aria-hidden="true">{icon}</span><span className="mn-action-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight size={16} aria-hidden="true" className="mn-action-chevron" /></a>;
}

export function LiveStrip({ event, health, liveLabel }: { event: ReactNode; health: ReactNode; liveLabel: string }) {
  return <div className="mn-live-strip" role="status" aria-live="polite"><span className="mn-live-tag">{liveLabel}</span><span className="mn-live-event">{event}</span><span className="mn-live-health">{health}</span></div>;
}

export function Sparkline({ data, label }: { data: Array<{ time: string; value: number }>; label: string }) {
  return <div className="mn-sparkline" role="img" aria-label={label}>
    {data.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><Line type="monotone" dataKey="value" stroke="var(--mn-accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : null}
  </div>;
}
