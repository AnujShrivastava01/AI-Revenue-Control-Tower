import type { Metadata } from "next";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import {
  AiControlCard,
  AttentionCard,
  BatchStats,
  DayHeading,
  MetricStrip,
  PriorityList,
  type StripMetric,
} from "@/components/control-tower/command-center-parts";
import { HourlyVolumeChart, RevenueChart } from "@/components/charts/charts";
import { getOverviewMetrics, getIncidentStats, getRefundStats } from "@/lib/analytics/metrics";
import { getAttentionCards, getPriorities, detectAnomalies } from "@/lib/ai/anomalyDetector";
import { listInvestigations } from "@/lib/ai/investigator";
import { getActions } from "@/lib/ai/decisionEngine";
import { getAiStatus } from "@/lib/ai/llm";
import { getDataset } from "@/lib/demo/dataset";
import { MERCHANT } from "@/lib/demo/config";
import { formatINR, formatPercent, formatShortINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Command Center" };
export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = { today: 14, "14d": 14, "42d": 42 };

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const range = typeof params.range === "string" ? params.range : "today";

  const m = getOverviewMetrics();
  const incident = getIncidentStats();
  const refunds = getRefundStats();
  const ds = getDataset();
  const cards = getAttentionCards();
  const priorities = getPriorities();
  const investigations = listInvestigations();
  const actions = getActions();
  const ai = getAiStatus();

  const days = RANGE_DAYS[range] ?? 14;
  const daily = m.daily.slice(-days);
  const revenueSeries = daily.map((d) => d.revenue);
  const refundSeries = daily.map((d) => d.refunds);
  const atRiskSeries = daily.map((d) => d.atRisk);
  const hourlyValues = m.hourly.map((h) => h.captured);
  const failureSeries = m.hourly.map((h) => (h.captured + h.failed ? h.failed / (h.captured + h.failed) : 0));

  const strip: StripMetric[] = [
    {
      label: "Revenue",
      value: formatShortINR(m.processedToday),
      sub: `${m.capturedCount.toLocaleString("en-IN")} captured`,
      series: revenueSeries,
    },
    {
      label: "Payments",
      value: m.transactionsAnalyzed.toLocaleString("en-IN"),
      sub: `${formatPercent(m.successRate)} success · ${formatPercent(m.baselineSuccessRate)} baseline`,
      series: hourlyValues,
      tone: "neutral",
    },
    {
      label: "Refunds",
      value: formatShortINR(m.refundValue),
      sub: `${m.refundCount} refunds · ${formatPercent(refunds.currentRate)} on ${refunds.product.sku}`,
      series: refundSeries,
      tone: "warn",
    },
    {
      label: "Revenue at risk",
      value: formatShortINR(m.revenueAtRisk),
      sub: `${detectAnomalies().length} open anomalies`,
      series: atRiskSeries,
      tone: "danger",
    },
    {
      label: "Recovered revenue",
      value: formatShortINR(m.recovered),
      sub: `${formatShortINR(m.potentialRecovery)} still recoverable`,
      series: daily.map((d) => Math.round(d.revenue * 0.004)),
      tone: "ok",
    },
  ];

  const cardStats: Record<string, { label: string; value: string }[]> = {
    anm_upi_degradation: [
      { label: "Affected payments", value: incident.affected.toLocaleString("en-IN") },
      { label: "Recoverable", value: formatShortINR(incident.recoverable) },
      { label: "Success rate", value: `${formatPercent(incident.preSuccessRate)} → ${formatPercent(incident.eventSuccessRate)}` },
    ],
    anm_recoverable_failures: [
      { label: "Customers", value: `${incident.highIntentCount} high-intent` },
      { label: "Exposure", value: formatShortINR(incident.highIntentValue) },
      { label: "Modelled rate", value: formatPercent(incident.highIntentRecoverable / incident.highIntentValue, 0) },
    ],
    anm_refund_spike: [
      { label: "SKU", value: refunds.product.sku },
      { label: "Excess value", value: formatShortINR(110_000) },
      { label: "Rate", value: `${formatPercent(refunds.baselineRate)} → ${formatPercent(refunds.currentRate)}` },
    ],
  };

  const cardCtas: Record<string, { label: string; href: string }> = {
    anm_upi_degradation: { label: "Investigate", href: "/investigations/inv_1042" },
    anm_recoverable_failures: { label: "Review recovery", href: "/actions/act_2041" },
    anm_refund_spike: { label: "Investigate", href: "/investigations/inv_1043" },
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <DayHeading
        merchantName={MERCHANT.name}
        processed={m.processedToday}
        delta={m.processedDelta}
        successRate={m.successRate}
        baselineSuccess={m.baselineSuccessRate}
        atRisk={m.revenueAtRisk}
      />

      <section className="mt-8" aria-labelledby="attention-heading">
        <h2
          id="attention-heading"
          className="mb-3 text-[15px] font-semibold tracking-[-0.015em] text-ink"
        >
          {cards.length} things need your attention
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((a) => (
            <AttentionCard
              key={a.id}
              anomaly={a}
              stats={cardStats[a.id] ?? []}
              cta={cardCtas[a.id] ?? { label: "Investigate", href: "/investigations" }}
            />
          ))}
        </div>
      </section>

      <section className="mt-8" aria-label="Financial overview">
        <MetricStrip metrics={strip} />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Revenue, refunds and exposure"
              meta={`${daily.length} days · ${daily[0]?.label} – ${daily[daily.length - 1]?.label}`}
              action={
                <div className="hidden items-center gap-3 text-2xs uppercase tracking-wider text-ink-3 sm:flex">
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-3 bg-ink-2" />
                    Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-3 bg-warn" />
                    Refunds
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-3 bg-danger" />
                    At risk
                  </span>
                </div>
              }
            />
            <div className="px-3 py-3">
              <RevenueChart data={daily} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Payment attempts by hour"
              meta={`Today · ${m.capturedCount.toLocaleString("en-IN")} captured, ${m.failedCount.toLocaleString("en-IN")} failed`}
              action={
                <div className="hidden items-center gap-3 text-2xs uppercase tracking-wider text-ink-3 sm:flex">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px] bg-[#d6d9dd]" />
                    Captured
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px] bg-danger" />
                    Failed
                  </span>
                </div>
              }
            />
            <div className="px-3 py-3">
              <HourlyVolumeChart data={m.hourly} />
            </div>
            <div className="border-t border-line px-4 py-2.5 text-xxs text-ink-3 tnum">
              Failure rate peaked at {formatPercent(Math.max(...failureSeries))} between 14:30 and
              16:10 · {incident.acuteCount.toLocaleString("en-IN")} of{" "}
              {incident.affected.toLocaleString("en-IN")} affected payments fall in that window
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <AiControlCard
            transactionsScanned={m.transactionsAnalyzed}
            anomalies={m.anomaliesDetected}
            investigations={investigations.filter((i) => i.status !== "resolved").length}
            awaitingApproval={actions.filter((a) => a.status === "pending_approval").length}
            label={ai.enabled ? "LLM-assisted narration · deterministic decisions" : "Deterministic detection, scoring and policy"}
          />
          <PriorityList anomalies={priorities} />
          <Panel>
            <PanelHeader title="Ledger" meta="Current batch" />
            <dl className="divide-y divide-line">
              {[
                { label: "Customers", value: ds.customers.length.toLocaleString("en-IN") },
                { label: "Average order value", value: formatINR(m.avgTransactionValue) },
                { label: "Settlement delay", value: `${m.settlementDelayDays.toFixed(1)} days` },
                { label: "Open checkout sessions", value: ds.checkoutSessions.filter((s) => !s.completed).length.toString() },
                { label: "Overdue invoices", value: ds.invoices.filter((i) => i.status === "overdue").length.toString() },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-2">
                  <dt className="text-[13px] text-ink-3">{row.label}</dt>
                  <dd className="text-[13px] font-medium text-ink tnum">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <section className="mt-4">
        <BatchStats
          items={[
            { label: "Transactions analysed", value: m.transactionsAnalyzed.toLocaleString("en-IN") },
            { label: "Anomalies detected", value: String(m.anomaliesDetected) },
            { label: "Investigations", value: String(m.investigations) },
            { label: "Revenue at risk", value: formatShortINR(m.revenueAtRisk) },
            { label: "Potential recovery", value: formatShortINR(m.potentialRecovery) },
            { label: "Recovered", value: formatShortINR(m.recovered) },
            { label: "Actions executed", value: String(m.actionsExecuted) },
            { label: "Blocked by policy", value: String(m.actionsBlocked) },
            { label: "Human approvals", value: String(m.humanApprovals) },
            { label: "Avg transaction value", value: formatINR(m.avgTransactionValue) },
          ]}
        />
      </section>
    </div>
  );
}
