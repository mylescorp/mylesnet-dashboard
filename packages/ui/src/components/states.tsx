import type { ReactNode } from "react";
import { KeyRound, TriangleAlert, WifiOff } from "lucide-react";
import type { AsyncState } from "../types";

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, body, action, icon, className }: EmptyStateProps) {
  return (
    <div className="empty-state mn-empty-state">
      {icon != null ? <span className="mn-empty-icon" aria-hidden="true">{icon}</span> : null}
      <h3>{title}</h3>
      {body != null ? <p>{body}</p> : null}
      {action != null ? <div className="mn-empty-action">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  body?: ReactNode;
  retry?: () => void;
  className?: string;
}

export function ErrorState({ title = "Something went wrong", body = "The data could not be loaded. Please try again.", retry, className }: ErrorStateProps) {
  return (
    <div className="mn-state mn-state-error" role="alert">
      <TriangleAlert size={30} aria-hidden="true" className="mn-state-icon" />
      <h3>{title}</h3>
      <p>{body}</p>
      {retry != null ? (
        <button type="button" className="secondary-button mn-btn-sm" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function OfflineBanner({ retry }: { retry?: () => void }) {
  return (
    <div className="mn-offline" role="status">
      <WifiOff size={16} aria-hidden="true" />
      <span>You appear to be offline — showing the last known data. Changes will sync when you reconnect.</span>
      {retry != null ? (
        <button type="button" className="mn-offline-retry" onClick={retry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export interface PermissionDeniedProps {
  title?: string;
  body?: ReactNode;
  className?: string;
}

export function PermissionDenied({ title = "Access denied", body = "You don't have permission to view this content.", className }: PermissionDeniedProps) {
  return (
    <div className="mn-state mn-state-permission" role="alert">
      <KeyRound size={30} aria-hidden="true" className="mn-state-icon" />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}