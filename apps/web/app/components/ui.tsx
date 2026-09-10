"use client";

import type { ReactNode } from "react";

/** Form field wrapper with label + children input. */
export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}{required ? <span className="pf-required" aria-hidden="true"> *</span> : null}</span>
      {children}
      {hint && <span className="pf-hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pf-input" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="pf-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="pf-input" {...props} />;
}

export function StatusPill({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  const cls = {
    success: "status-pill-success",
    warning: "status-pill-warning",
    danger: "status-pill-danger",
    neutral: "status-pill-neutral",
  }[tone];
  return <span className={`status-pill ${cls}`}>{children}</span>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}

export function Loading() {
  return <div className="loading-panel">Loading…</div>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="pf-error">{children}</p>;
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

export function formatDate(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
