"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

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
    console.error("Panel surface query failed:", error, info);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="workspace-page" role="alert">
          <div className="pf-panel">
            <p className="eyebrow">Data access error</p>
            <h2 className="page-title">This surface could not be loaded</h2>
            <p className="pf-hint">
              {this.state.error.message || "The query server rejected the request."} This usually means your
              current role is not permitted for this surface. If the problem persists, contact a platform administrator.
            </p>
            <button type="button" className="secondary-button" onClick={this.reset}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}