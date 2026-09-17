"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { toUserFacingError } from "@/shared/lib/user-facing-error";

type BoundaryProps = { children: ReactNode; onReset?: () => void };
type BoundaryState = { error: Error | null };

/**
 * Catches errors thrown while rendering a panel surface (e.g. Convex `useQuery`
 * re-throws on query failure, including authorization denials). Surfaces them
 * as a recoverable notice instead of an eternal "Loading…" or a crash.
 */
export class QueryErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Intentionally do not render diagnostics. Observability integrations may
    // consume this hook later without exposing errors through the browser UI.
    void error;
    void info;
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      const safe = toUserFacingError(this.state.error);
      return (
        <div className="workspace-page" role="alert">
          <div className="pf-panel">
            <p className="eyebrow">Workspace</p>
            <h2 className="page-title">{safe.title}</h2>
            <p className="pf-hint">
              {safe.message}
            </p>
            <button type="button" className="secondary-button" onClick={this.reset}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
