"use client";

import type { ReactNode } from "react";

export function AppBootstrapLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="app-bootstrap" role="status" aria-live="polite">
      <img
        className="app-bootstrap-logo"
        src="/brand/mylesnet-logo.png"
        alt="MylesNet"
        width={180}
        height={54}
      />
      <span className="app-bootstrap-label">{label}</span>
      <span className="loading-skeleton loading-skeleton-title" />
      <span className="loading-skeleton loading-skeleton-line" />
      <span className="loading-skeleton loading-skeleton-line loading-skeleton-line-short" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
