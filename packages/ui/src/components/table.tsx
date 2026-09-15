"use client";

import type { ReactNode } from "react";
import { cn } from "../utils";
import { BillingLogoLoader } from "./loading";
import { EmptyState, ErrorState } from "./states";
import { Skeleton } from "./skeleton";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  /** Cells dropped below this breakpoint (harmless fallback kept for parity). */
  hideBelow?: "none" | "md" | "lg";
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  recordCountLabel?: string;
  emptyTitle?: string;
  emptyBody?: string;
  error?: boolean;
  onRetry?: () => void;
  pagination?: PaginationInfo;
  className?: string;
}

function SkeletonTable({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="mn-table-scroll">
      <table className="mn-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j}>
                  <Skeleton className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  title,
  description,
  toolbar,
  recordCountLabel,
  emptyTitle = "Nothing here yet",
  emptyBody,
  error = false,
  onRetry,
  pagination,
  className,
}: DataTableProps<T>) {
  if (error) {
    return (
      <div className="mn-table-shell">
        <div className="loading-panel">
          <ErrorState retry={onRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mn-table-shell">
        <div className="mn-table-toolbar">
          {title != null ? <h2 className="mn-table-title">{title}</h2> : null}
          {description != null ? <p className="mn-table-description">{description}</p> : null}
          {toolbar != null ? <div className="mn-table-toolbar-actions">{toolbar}</div> : null}
        </div>
        <SkeletonTable rows={5} cols={columns.length} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mn-table-shell">
        <div className="mn-table-toolbar">
          {title != null ? <h2 className="mn-table-title">{title}</h2> : null}
          {description != null ? <p className="mn-table-description">{description}</p> : null}
          {toolbar != null ? <div className="mn-table-toolbar-actions">{toolbar}</div> : null}
        </div>
        <div className="loading-panel">
          <EmptyState title={emptyTitle} body={emptyBody} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mn-table-shell", className)}>
      <div className="mn-table-toolbar">
        {title != null ? <h2 className="mn-table-title">{title}</h2> : null}
        {description != null ? <p className="mn-table-description">{description}</p> : null}
        {toolbar != null ? <div className="mn-table-toolbar-actions">{toolbar}</div> : null}
      </div>
      <div className="mn-table-scroll">
        <table className="mn-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ 
                    textAlign: col.align || "left",
                    width: col.width,
                  }}
                  className={col.hideBelow !== "none" ? `mn-hide-${col.hideBelow}` : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || "left" }}
                    className={col.hideBelow !== "none" ? `mn-hide-${col.hideBelow}` : undefined}
                  >
                    {col.cell ? col.cell(row) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recordCountLabel != null || pagination != null ? (
        <div className="mn-table-footer">
          {recordCountLabel != null ? <span className="mn-table-count">{recordCountLabel}</span> : null}
          {pagination != null ? (
            <div className="mn-table-pagination">
              <button
                type="button"
                className="mn-pagination-btn"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPage(pagination.page - 1)}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="mn-pagination-info">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <button
                type="button"
                className="mn-pagination-btn"
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                onClick={() => pagination.onPage(pagination.page + 1)}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}