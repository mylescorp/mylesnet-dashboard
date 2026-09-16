import type { ReactNode } from "react";
import { cn } from "../utils";

export interface SkeletonProps {
  variant?: "text" | "line" | "title" | "card" | "table-row" | "chart" | "pill";
  className?: string;
  children?: ReactNode;
}

/** Accessible placeholder that inherits reduced-motion and theme tokens. */
export function Skeleton({ variant = "line", className, children }: SkeletonProps) {
  return (
    <div role="status" aria-label="Loading" className={cn("mn-skeleton", `mn-skeleton-${variant}`, className)}>
      {children}
    </div>
  );
}

/** Skeleton card used for dashboard-placeholder panels while data loads. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("mn-skeleton-card", className)}>
      <Skeleton variant="title" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="line" className={i === lines - 1 ? "mn-skeleton-line-short" : undefined} />
      ))}
    </div>
  );
}

/** Skeleton table body (kept off-screen labelled loads-free of spinners). */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table className="mn-table mn-skeleton-table" aria-hidden="true">
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}>
              <Skeleton variant="line" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}>
                <Skeleton variant="line" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}