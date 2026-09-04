"use client";

import * as React from "react";
import { Button } from "@/components/ui/primitives";

/**
 * Route-level error boundary. The operator is told what could not be read and
 * what to do next; the underlying exception is logged, never rendered.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[control-tower] route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-20">
      <p className="eyebrow mb-3">Unavailable</p>
      <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
        Unable to retrieve this view.
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
        The underlying data could not be read. Nothing was changed and no action was dispatched.
        Retrying re-runs the read against the same seeded batch.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[11.5px] text-ink-4">reference {error.digest}</p>
      ) : null}
      <div className="mt-5">
        <Button variant="primary" size="lg" onClick={reset}>
          Retry
        </Button>
      </div>
    </div>
  );
}
