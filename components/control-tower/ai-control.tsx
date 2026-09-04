"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/drawer";
import { Badge, ErrorState, Skeleton, StatusDot } from "@/components/ui/primitives";
import type { AiStatus } from "@/lib/ai/llm";

export interface AiControlSnapshot {
  takenAt: string;
  transactionsScanned: number;
  signalsEvaluated: number;
  investigationsActive: number;
  actionsAwaitingApproval: number;
  observations: {
    key: string;
    label: string;
    display: string;
    window: string;
    sampleSize: number;
    status: "normal" | "breached";
  }[];
  pipeline: { stage: string; module: string; state: string }[];
}

export function AiControlPanel({
  open,
  onClose,
  ai,
}: {
  open: boolean;
  onClose: () => void;
  ai: AiStatus;
}) {
  const [load, setLoad] = React.useState<{
    data: AiControlSnapshot | null;
    error: boolean;
  }>({ data: null, error: false });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/ai/control")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((json: AiControlSnapshot) => {
        if (!cancelled) setLoad({ data: json, error: false });
      })
      .catch(() => {
        if (!cancelled) setLoad({ data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [open, nonce]);

  const { data, error } = load;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="AI control"
      subtitle="What the system is watching, and what it has concluded"
      width="max-w-[480px]"
    >
      {error ? (
        <ErrorState
          title="Unable to read the monitoring snapshot."
          detail="The observer endpoint did not respond. The underlying data is unaffected."
          onRetry={() => {
            setLoad({ data: null, error: false });
            setNonce((n) => n + 1);
          }}
        />
      ) : !data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-md border border-line bg-raised p-3">
            <div className="mb-2 flex items-center gap-2">
              <StatusDot tone="ok" pulse />
              <span className="text-[13px] font-medium text-ink">Monitoring</span>
              <Badge tone={ai.enabled ? "accent" : "neutral"} className="ml-auto">
                {ai.enabled ? "LLM-assisted" : "Deterministic"}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                { label: "Transactions analysed", value: data.transactionsScanned.toLocaleString("en-IN") },
                { label: "Anomalies evaluated", value: String(data.signalsEvaluated) },
                { label: "Investigations active", value: String(data.investigationsActive) },
                { label: "Actions awaiting approval", value: String(data.actionsAwaitingApproval) },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="eyebrow mb-0.5">{s.label}</dt>
                  <dd className="text-[15px] font-semibold text-ink tnum">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="eyebrow mb-2.5">Signals under watch</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {data.observations.map((o) => (
                <li key={o.key} className="flex items-center gap-3 px-3 py-2.5">
                  <StatusDot tone={o.status === "breached" ? "danger" : "ok"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{o.label}</div>
                    <div className="truncate text-xxs text-ink-4">
                      {o.window} · n={o.sampleSize.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] font-medium text-ink tnum">
                    {o.display}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="eyebrow mb-2.5">Pipeline</h3>
            <ol className="space-y-px overflow-hidden rounded-md border border-line">
              {data.pipeline.map((p, i) => (
                <li
                  key={p.stage}
                  className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
                >
                  <span className="w-5 shrink-0 font-mono text-[11px] text-ink-4 tnum">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="w-[86px] shrink-0 text-[13px] text-ink">{p.stage}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-4">
                    {p.module}
                  </span>
                  <span className="shrink-0 text-2xs uppercase tracking-wider text-ink-3">
                    {p.state}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <p className="text-[12.5px] leading-relaxed text-ink-3">{ai.detail}</p>
        </div>
      )}
    </Drawer>
  );
}
