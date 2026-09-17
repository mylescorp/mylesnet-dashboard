"use client";

/** Last-resort safe error UI. It owns its document because the root layout failed. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main>
          <p>MylesNet</p>
          <h1>Something went wrong</h1>
          <p>Please try again. If the problem continues, contact your administrator.</p>
          <button type="button" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
