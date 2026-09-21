"use client";

import { useEffect } from "react";

/** Route-level safe recovery UI. Never render the original error or digest. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Error reporting is intentionally configured outside the user interface.
  }, []);

  return (
    <main className="workspace-page" role="alert">
      <section className="pf-panel">
        <p className="eyebrow">MylesNet</p>
        <h1 className="page-title">We could not load this page</h1>
        <p className="pf-hint">Please try again. If the problem continues, contact your administrator.</p>
        <button type="button" className="primary-button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
