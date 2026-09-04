"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Badge, KeyValue, Panel } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { Sparkline } from "@/components/charts/charts";
import { cn, dateTimeIST, formatPercent } from "@/lib/utils";
import type { MerchantMemoryRecord } from "@/lib/types";

const STATUS: Record<
  MerchantMemoryRecord["status"],
  { label: string; tone: "ok" | "warn" | "danger"; rule: string }
> = {
  normal: { label: "Normal", tone: "ok", rule: "bg-ok" },
  drifting: { label: "Drifting", tone: "warn", rule: "bg-warn" },
  unusual: { label: "Unusual", tone: "danger", rule: "bg-danger" },
};

export function MemoryGrid({ records }: { records: MerchantMemoryRecord[] }) {
  const params = useSearchParams();
  // Resolved at mount: `?open=` only arrives via navigation from search.
  const [openId, setOpenId] = React.useState<string | null>(() => {
    const requested = params.get("open");
    return requested && records.some((r) => r.id === requested) ? requested : null;
  });
  const active = records.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {records.map((r) => {
          const status = STATUS[r.status];
          return (
            <Panel key={r.id} className="overflow-hidden">
              <div className={cn("h-[2px] w-full", status.rule)} aria-hidden />
              <button
                onClick={() => setOpenId(r.id)}
                className="flex w-full flex-col items-stretch p-4 text-left transition-colors hover:bg-raised"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="eyebrow">{r.title}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>

                <p className="mb-3.5 text-[13px] leading-[1.5] text-ink-3">{r.statement}</p>

                <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <div>
                    <dt className="eyebrow mb-1">{r.baselineLabel}</dt>
                    <dd className="text-[17px] font-semibold tracking-[-0.02em] text-ink-2 tnum">
                      {r.baselineValue}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow mb-1">{r.currentLabel}</dt>
                    <dd
                      className={cn(
                        "text-[17px] font-semibold tracking-[-0.02em] tnum",
                        r.status === "unusual" ? "text-danger" : r.status === "drifting" ? "text-warn" : "text-ink",
                      )}
                    >
                      {r.currentValue}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <Sparkline
                    values={r.series.map((s) => s.value)}
                    tone={r.status === "unusual" ? "danger" : r.status === "drifting" ? "warn" : "ok"}
                    height={26}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5">
                  <span className="truncate text-xxs text-ink-4">{r.source}</span>
                  <span className="shrink-0 text-xxs text-ink-4 tnum">
                    {formatPercent(r.confidence, 0)} confidence
                  </span>
                </div>
              </button>
            </Panel>
          );
        })}
      </div>

      <Drawer
        open={Boolean(active)}
        onClose={() => setOpenId(null)}
        title={active?.title ?? ""}
        subtitle={active ? `${active.baselineLabel} ${active.baselineValue} → ${active.currentLabel} ${active.currentValue}` : ""}
        width="max-w-[520px]"
      >
        {active ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS[active.status].tone}>{STATUS[active.status].label}</Badge>
              <span className="font-mono text-[11px] text-ink-4">{active.key}</span>
            </div>

            <div>
              <h3 className="eyebrow mb-2">Why the system believes this</h3>
              <p className="text-[13.5px] leading-[1.65] text-ink-2">{active.why}</p>
            </div>

            <div className="rounded-md border border-line p-3">
              <h3 className="eyebrow mb-2.5">Supporting evidence</h3>
              <KeyValue columns={2} items={active.evidence} />
            </div>

            <div className="rounded-md border border-line p-3">
              <h3 className="eyebrow mb-2.5">Observed series</h3>
              <Sparkline
                values={active.series.map((s) => s.value)}
                tone={active.status === "unusual" ? "danger" : "neutral"}
                height={54}
              />
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-ink-4">
                <span>{active.series[0]?.label}</span>
                <span>{active.series[active.series.length - 1]?.label}</span>
              </div>
            </div>

            <div className="rounded-md border border-line p-3">
              <KeyValue
                columns={2}
                items={[
                  { label: "Source", value: active.source },
                  { label: "Learned from", value: active.learnedFrom },
                  { label: "Observations", value: active.observations.toLocaleString("en-IN"), mono: true },
                  { label: "Confidence", value: formatPercent(active.confidence, 0) },
                  { label: "Last updated", value: dateTimeIST(active.lastUpdated) },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
