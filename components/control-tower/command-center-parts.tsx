import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Panel, PanelHeader, StatusDot } from "@/components/ui/primitives";
import { Sparkline } from "@/components/charts/charts";
import {
  cn,
  formatINR,
  formatPercent,
  formatShortINR,
  formatSignedPercent,
} from "@/lib/utils";
import type { Anomaly } from "@/lib/types";

/* ------------------------------------------------------- attention cards */

const SEVERITY: Record<
  Anomaly["severity"],
  { label: string; tone: "danger" | "ok" | "warn"; rule: string }
> = {
  critical: { label: "Critical", tone: "danger", rule: "bg-danger" },
  opportunity: { label: "Opportunity", tone: "ok", rule: "bg-ok" },
  watch: { label: "Watch", tone: "warn", rule: "bg-warn" },
};

export function AttentionCard({
  anomaly,
  stats,
  cta,
}: {
  anomaly: Anomaly;
  stats: { label: string; value: string }[];
  cta: { label: string; href: string };
}) {
  const sev = SEVERITY[anomaly.severity];
  return (
    <Panel className="group flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <div className={cn("h-[2px] w-full", sev.rule)} aria-hidden />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge tone={sev.tone}>{sev.label}</Badge>
          <span className="font-mono text-[11px] text-ink-4 tnum">
            {anomaly.detectedAt.slice(11, 16)} IST
          </span>
        </div>

        <h3 className="text-[21px] font-semibold leading-tight tracking-[-0.022em] text-ink tnum">
          {anomaly.headline}
        </h3>

        <p className="mt-2 text-[13px] leading-[1.55] text-ink-3">{anomaly.detail}</p>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="eyebrow mb-1">{s.label}</dt>
              <dd className="truncate text-[13px] font-medium text-ink tnum">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 pt-1">
          <Link
            href={cta.href}
            className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-accent"
          >
            {cta.label}
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="transition-transform duration-150 group-hover:translate-x-1"
            />
          </Link>
          <span className="text-xxs text-ink-4 tnum">
            Confidence {formatPercent(anomaly.confidence, 0)}
          </span>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------- metric strip */

export interface StripMetric {
  label: string;
  value: string;
  sub: string;
  series: number[];
  tone?: "neutral" | "ok" | "warn" | "danger";
  baseline?: number;
}

export function MetricStrip({ metrics }: { metrics: StripMetric[] }) {
  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="min-w-0 p-3.5 transition-colors duration-150 hover:bg-raised"
          >
            <div className="eyebrow mb-1.5">{m.label}</div>
            <div
              className={cn(
                "text-[18px] font-semibold leading-none tracking-[-0.02em] tnum",
                m.tone === "danger" && "text-danger",
                m.tone === "ok" && "text-ok",
                m.tone === "warn" && "text-warn",
              )}
            >
              {m.value}
            </div>
            <div className="mt-1.5 truncate text-xxs text-ink-3 tnum">{m.sub}</div>
            <div className="mt-2.5">
              <Sparkline values={m.series} tone={m.tone ?? "neutral"} baseline={m.baseline} height={24} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ priorities */

export function PriorityList({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <Panel>
      <PanelHeader title="AI priorities" meta="Ranked by financial impact" />
      <ol>
        {anomalies.map((a, i) => {
          const href = a.investigationId
            ? `/investigations/${a.investigationId}`
            : "/opportunities";
          return (
            <li key={a.id} className="border-b border-line last:border-b-0">
              <Link
                href={href}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-raised"
              >
                <span className="w-5 shrink-0 font-mono text-[11px] text-ink-4 tnum">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <StatusDot
                  tone={
                    a.severity === "critical"
                      ? "danger"
                      : a.severity === "watch"
                        ? "warn"
                        : "ok"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{a.title}</span>
                  <span className="block truncate text-xxs text-ink-4">
                    {a.affectedCount.toLocaleString("en-IN")} affected · confidence{" "}
                    {formatPercent(a.confidence, 0)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-medium text-ink tnum">
                  {formatShortINR(a.impact)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------ AI control */

export function AiControlCard({
  transactionsScanned,
  anomalies,
  investigations,
  awaitingApproval,
  label,
}: {
  transactionsScanned: number;
  anomalies: number;
  investigations: number;
  awaitingApproval: number;
  label: string;
}) {
  const rows = [
    { label: "transactions analysed", value: transactionsScanned.toLocaleString("en-IN") },
    { label: "anomalies evaluated", value: String(anomalies) },
    { label: "investigations active", value: String(investigations) },
    { label: "actions awaiting approval", value: String(awaitingApproval) },
  ];
  return (
    <Panel>
      <PanelHeader
        title="AI control"
        action={
          <span className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-3">
            <StatusDot tone="ok" pulse />
            Monitoring
          </span>
        }
      />
      <ul className="px-4 py-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline gap-3 py-[5px]">
            <span className="text-[15px] font-semibold text-ink tnum">{r.value}</span>
            <span className="text-[13px] text-ink-3">{r.label}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-4 py-2.5">
        <span className="text-xxs text-ink-4">{label}</span>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------- batch stats */

export function BatchStats({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Synthetic / test environment"
        meta="Cumulative across the seeded 42-day batch"
      />
      <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-5">
        {items.map((s) => (
          <div key={s.label} className="p-3.5">
            <dt className="eyebrow mb-1.5">{s.label}</dt>
            <dd className="text-[16px] font-semibold text-ink tnum">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* --------------------------------------------------------------- heading */

export function DayHeading({
  merchantName,
  processed,
  delta,
  successRate,
  baselineSuccess,
  atRisk,
}: {
  merchantName: string;
  processed: number;
  delta: number;
  successRate: number;
  baselineSuccess: number;
  atRisk: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="eyebrow mb-2">Good morning, {merchantName}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[28px] font-semibold leading-none tracking-[-0.028em] text-ink tnum">
            {formatShortINR(processed)}
          </h1>
          <span className="text-[14px] text-ink-3">processed today</span>
          <span
            className={cn(
              "text-[13px] font-medium tnum",
              delta >= 0 ? "text-ok" : "text-danger",
            )}
          >
            {formatSignedPercent(delta)} vs normal
          </span>
        </div>
        <p className="mt-2 text-[13px] text-ink-3 tnum">
          {formatINR(processed)} captured · success rate{" "}
          <span className="font-medium text-ink">{formatPercent(successRate)}</span> against a{" "}
          {formatPercent(baselineSuccess)} baseline ·{" "}
          <span className="font-medium text-danger">{formatShortINR(atRisk)}</span> at risk
        </p>
      </div>
    </div>
  );
}
