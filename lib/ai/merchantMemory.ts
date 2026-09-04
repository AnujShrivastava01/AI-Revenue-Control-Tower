import * as C from "@/lib/demo/config";
import { getDataset } from "@/lib/demo/dataset";
import {
  getCheckoutStats,
  getIncidentStats,
  getOverviewMetrics,
  getRefundStats,
} from "@/lib/analytics/metrics";
import { formatPercent, formatShortINR } from "@/lib/utils";
import type { MerchantMemoryRecord } from "@/lib/types";

/**
 * Merchant Memory.
 *
 * Baselines are learned from the 42-day synthetic history and are what makes an
 * anomaly an *anomaly* rather than a threshold alert: every detection compares
 * today's observation against this merchant's own normal, not a global rule.
 */
export function getMerchantMemory(): MerchantMemoryRecord[] {
  const ds = getDataset();
  const m = getOverviewMetrics();
  const incident = getIncidentStats();
  const refunds = getRefundStats();
  const checkout = getCheckoutStats();
  const history = ds.daily.slice(0, -1); // exclude today's partial day
  const lastUpdated = C.DEMO_NOW;

  const failureSeries = history.slice(-14).map((d) => ({ label: d.label, value: d.failureRate }));
  const upiSeries = history.slice(-14).map((d) => ({ label: d.label, value: d.upiMix }));
  const refundSeries = history
    .slice(-14)
    .map((d) => ({ label: d.label, value: d.anomalousProductRefundRate }));
  const sundays = history.filter((d) => d.weekday === 0);
  const settlementSeries = history.slice(-14).map((d) => ({ label: d.label, value: d.settlementDelayDays }));

  const learnedFailureRate =
    history.reduce((a, d) => a + d.failureRate, 0) / Math.max(1, history.length);
  const learnedUpiMix = history.reduce((a, d) => a + d.upiMix, 0) / Math.max(1, history.length);
  const currentFailureRate = m.failedCount / m.transactionsAnalyzed;

  return [
    {
      id: "mem_failure_rate",
      key: "payment_failure_rate",
      title: "Payment behaviour",
      statement: "Share of payment attempts that fail on an ordinary trading day.",
      baselineLabel: "Learned baseline",
      baselineValue: formatPercent(learnedFailureRate),
      currentLabel: "Today",
      currentValue: formatPercent(currentFailureRate),
      status: "unusual",
      confidence: 0.96,
      observations: history.reduce((a, d) => a + d.transactions, 0),
      source: "Transaction ledger · 42 days",
      learnedFrom: `${history.length} complete trading days`,
      lastUpdated,
      why: `Across ${history.length} days the failure rate never left the ${formatPercent(0.018)}–${formatPercent(0.024)} band. Today's rate sits ${(currentFailureRate / learnedFailureRate).toFixed(1)}× above that band, and the excess is not spread evenly — it starts at 09:12.`,
      evidence: [
        { label: "Observed band (42d)", value: "1.8% – 2.4%" },
        { label: "Today", value: formatPercent(currentFailureRate) },
        { label: "Failed attempts today", value: m.failedCount.toLocaleString("en-IN"), mono: true },
        { label: "Attributed to incident", value: incident.affected.toLocaleString("en-IN"), mono: true },
      ],
      series: failureSeries,
      unit: "percent",
    },
    {
      id: "mem_bankx_share",
      key: "bank_failure_concentration",
      title: "Issuer concentration",
      statement: "Share of failed UPI payments that involve Bank X.",
      baselineLabel: "Learned baseline",
      baselineValue: formatPercent(incident.bankBaselineShare, 0),
      currentLabel: "Incident cohort",
      currentValue: formatPercent(incident.bankShare, 0),
      status: "unusual",
      confidence: 0.94,
      observations: 41_800,
      source: "Payment events · issuer breakdown",
      learnedFrom: "Rolling 30-day failure mix",
      lastUpdated,
      why: `Bank X carries ${formatPercent(C.BANKS[0].share, 0)} of this merchant's UPI volume, and historically ${formatPercent(incident.bankBaselineShare, 0)} of its failures. Inside the incident cohort it carries ${formatPercent(incident.bankShare, 0)} of failures — a ${incident.concentrationMultiple.toFixed(1)}× concentration that no other segment shows.`,
      evidence: [
        { label: "Bank X volume share", value: formatPercent(C.BANKS[0].share, 0) },
        { label: "Baseline failure share", value: formatPercent(incident.bankBaselineShare, 0) },
        { label: "Incident failure share", value: formatPercent(incident.bankShare, 0) },
        { label: "Concentration", value: `${incident.concentrationMultiple.toFixed(1)}×` },
      ],
      series: incident.segments.map((s) => ({ label: s.label, value: s.incidentShare })),
      unit: "percent",
    },
    {
      id: "mem_upi_mix",
      key: "upi_mix",
      title: "UPI mix",
      statement: "Share of payment attempts initiated over UPI.",
      baselineLabel: "Normal",
      baselineValue: formatPercent(learnedUpiMix, 0),
      currentLabel: "Today",
      currentValue: formatPercent(ds.daily[ds.daily.length - 1].upiMix, 0),
      status: "normal",
      confidence: 0.97,
      observations: history.reduce((a, d) => a + d.transactions, 0),
      source: "Transaction ledger · method mix",
      learnedFrom: `${history.length} complete trading days`,
      lastUpdated,
      why: "Customers are still choosing UPI at the usual rate. That matters: the degradation is in fulfilment of UPI payments, not in customer preference, so demand has not moved.",
      evidence: [
        { label: "42-day mean", value: formatPercent(learnedUpiMix, 1) },
        { label: "Today", value: formatPercent(ds.daily[ds.daily.length - 1].upiMix, 1) },
        { label: "Deviation", value: "within 1 s.d." },
      ],
      series: upiSeries,
      unit: "percent",
    },
    {
      id: "mem_refund_behaviour",
      key: "refund_behaviour",
      title: "Refund behaviour",
      statement: `Refund rate on ${refunds.product.name} (${refunds.product.sku}).`,
      baselineLabel: "Normal",
      baselineValue: formatPercent(refunds.baselineRate),
      currentLabel: "Current",
      currentValue: formatPercent(refunds.currentRate),
      status: "unusual",
      confidence: 0.88,
      observations: 9_400,
      source: "Refund ledger · per-SKU",
      learnedFrom: "42 days, segmented by SKU",
      lastUpdated,
      why: `${refunds.product.name} held a stable ${formatPercent(refunds.baselineRate)} refund rate for 33 days, then stepped up 9 days ago and has not come back down. No other SKU moved, which rules out a delivery-network or policy change.`,
      evidence: [
        { label: "Baseline (33 days)", value: formatPercent(refunds.baselineRate) },
        { label: "Last 9 days", value: formatPercent(refunds.currentRate) },
        { label: "Excess refund value", value: formatShortINR(refunds.excessRefundValue) },
        { label: "Leading reason", value: refunds.topReason },
      ],
      series: refundSeries,
      unit: "percent",
    },
    {
      id: "mem_sunday_revenue",
      key: "sunday_revenue",
      title: "Sunday revenue",
      statement: "Sundays trade at roughly a third of a weekday for this merchant.",
      baselineLabel: "Typical",
      baselineValue: `${formatShortINR(C.BASELINE.sundayRevenueLow)} – ${formatShortINR(C.BASELINE.sundayRevenueHigh)}`,
      currentLabel: "Last Sunday",
      currentValue: formatShortINR(sundays[sundays.length - 1]?.revenue ?? 0),
      status: "normal",
      confidence: 0.92,
      observations: sundays.length,
      source: "Daily settlement aggregates",
      learnedFrom: `${sundays.length} Sundays observed`,
      lastUpdated,
      why: "Weekend softness is structural for this merchant, not a problem. Encoding it stops the detector from raising an anomaly every Sunday morning.",
      evidence: sundays.slice(-4).map((s) => ({ label: s.label, value: formatShortINR(s.revenue), mono: true })),
      series: sundays.map((s) => ({ label: s.label, value: s.revenue })),
      unit: "inr",
    },
    {
      id: "mem_settlement_timing",
      key: "settlement_timing",
      title: "Settlement timing",
      statement: "Days between capture and funds landing in the merchant's bank account.",
      baselineLabel: "Typical",
      baselineValue: `${C.BASELINE.settlementDays.toFixed(1)} days`,
      currentLabel: "Current",
      currentValue: `${m.settlementDelayDays.toFixed(1)} days`,
      status: "normal",
      confidence: 0.9,
      observations: ds.settlements.length,
      source: "Settlement records · UTR matched",
      learnedFrom: "Last 14 settlement cycles",
      lastUpdated,
      why: "A 0.1-day drift is inside normal banking variance. The open item on settlements is a value discrepancy, not a timing one — the two are tracked separately so a slow day is never mistaken for missing money.",
      evidence: ds.settlements.slice(0, 4).map((s) => ({
        label: s.utr,
        value: `${formatShortINR(s.amount)} · ${s.status}`,
        mono: true,
      })),
      series: settlementSeries,
      unit: "days",
    },
    {
      id: "mem_checkout_conversion",
      key: "checkout_conversion",
      title: "Checkout conversion",
      statement: "Share of started checkout sessions that reach a completed payment.",
      baselineLabel: "Normal",
      baselineValue: formatPercent(checkout.baselineConversion),
      currentLabel: "Today",
      currentValue: formatPercent(checkout.conversion),
      status: "drifting",
      confidence: 0.85,
      observations: 26_400,
      source: "Checkout session log",
      learnedFrom: "42 days of session funnels",
      lastUpdated,
      why: `Drop-off is concentrated at the payment-method step rather than at cart or contact, which is consistent with customers abandoning after seeing a failed UPI attempt rather than with a pricing or delivery objection.`,
      evidence: [
        { label: "Sessions today", value: String(checkout.total), mono: true },
        { label: "Abandoned", value: String(checkout.abandonedCount), mono: true },
        { label: "Value at stake", value: formatShortINR(checkout.abandonedValue) },
        { label: "Leading stage", value: "Payment method selection" },
      ],
      series: history.slice(-14).map((d) => ({ label: d.label, value: 0.938 - d.failureRate * 0.4 })),
      unit: "percent",
    },
  ];
}

export function getMemoryRecord(id: string): MerchantMemoryRecord | undefined {
  return getMerchantMemory().find((m) => m.id === id || m.key === id);
}
