"use client";

import type { ReactNode } from "react";
import Image from "next/image";

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

export function Loading({ label = "Loading content" }: { label?: string }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite" aria-label={label}>
      <Image
        className="loading-logo"
        src="/brand/mylesnet-logo.png"
        alt="MylesNet"
        width={160}
        height={48}
        priority
      />
      <span className="loading-skeleton loading-skeleton-title" />
      <span className="loading-skeleton loading-skeleton-line" />
      <span className="loading-skeleton loading-skeleton-line loading-skeleton-line-short" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="pf-error" role="alert">
      <span>{children}</span>
      {onRetry ? <button type="button" className="pf-button pf-button-compact" onClick={onRetry}>Try again</button> : null}
    </div>
  );
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
