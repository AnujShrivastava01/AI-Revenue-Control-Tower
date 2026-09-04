import * as C from "@/lib/demo/config";
import {
  getChargebackStats,
  getCheckoutStats,
  getIncidentStats,
  getOverviewMetrics,
  getReceivablesStats,
  getRefundStats,
  getSettlementStats,
} from "@/lib/analytics/metrics";
import { formatPercent, formatShortINR } from "@/lib/utils";
import type { Anomaly } from "@/lib/types";

/**
 * Anomaly detector — stage 3 of the loop.
 *
 * Each anomaly is an observation that has broken away from a Merchant Memory
 * baseline by enough to matter *financially*. Detection is deterministic: a
 * signal either exceeds its learned band or it does not.
 */

const ONSET_TIME = C.EVENT_ONSET;

/** Anomalies that are views onto another anomaly's cohort, excluded from the risk rollup. */
export const DERIVED_ANOMALIES = new Set(["anm_recoverable_failures"]);

export function detectAnomalies(): Anomaly[] {
  const incident = getIncidentStats();
  const refunds = getRefundStats();
  const checkout = getCheckoutStats();
  const settlement = getSettlementStats();
  const receivables = getReceivablesStats();
  const chargebacks = getChargebackStats();
  const m = getOverviewMetrics();

  const anomalies: Anomaly[] = [
    {
      id: "anm_upi_degradation",
      kind: "payment_degradation",
      title: "UPI payment degradation",
      severity: "critical",
      detectedAt: "2026-02-18T14:32:11+05:30",
      headline: `${formatShortINR(incident.atRisk)} revenue at risk`,
      detail: `UPI failures concentrated in Bank X rose ${incident.concentrationMultiple.toFixed(1)}× above this merchant's 30-day baseline — ${formatPercent(incident.bankBaselineShare, 0)} of failures normally, ${formatPercent(incident.bankShare, 0)} since ${ONSET_TIME.slice(11, 16)}.`,
      impact: incident.atRisk,
      recoverable: incident.recoverable,
      confidence: 0.91,
      observedValue: incident.eventSuccessRate,
      baselineValue: incident.preSuccessRate,
      unit: "percent",
      affectedCount: incident.affected,
      investigationId: "inv_1042",
      metricLabel: "Payment success rate",
    },
    {
      id: "anm_recoverable_failures",
      kind: "recoverable_failures",
      title: "Recoverable failed payments",
      severity: "opportunity",
      detectedAt: "2026-02-18T14:36:20+05:30",
      headline: `${formatShortINR(incident.highIntentRecoverable)} potentially recoverable`,
      detail: `${incident.highIntentCount} failed payments show high recovery probability — repeat customers whose attempt failed on a degraded rail, not on funds or authentication.`,
      impact: incident.highIntentValue,
      recoverable: incident.highIntentRecoverable,
      confidence: 0.82,
      observedValue: incident.highIntentRecoverable / incident.highIntentValue,
      baselineValue: 0.31,
      unit: "percent",
      affectedCount: incident.highIntentCount,
      investigationId: "inv_1042",
      metricLabel: "Modelled recovery rate",
    },
    {
      id: "anm_refund_spike",
      kind: "refund_spike",
      title: "Refund behaviour changed",
      severity: "watch",
      detectedAt: "2026-02-18T08:04:02+05:30",
      headline: `${refunds.product.name} refund rate ${formatPercent(refunds.baselineRate)} → ${formatPercent(refunds.currentRate)}`,
      detail: `Refunds on ${refunds.product.sku} stepped up 9 days ago and stayed there. No other SKU moved, so this is product-specific rather than a delivery or policy change.`,
      impact: C.ANOMALY_LEDGER.refund_spike.impact,
      recoverable: C.ANOMALY_LEDGER.refund_spike.recoverable,
      confidence: 0.88,
      observedValue: refunds.currentRate,
      baselineValue: refunds.baselineRate,
      unit: "percent",
      affectedCount: refunds.refundCount,
      investigationId: "inv_1043",
      metricLabel: "Refund rate",
    },
    {
      id: "anm_receivables",
      kind: "receivables_ageing",
      title: "Overdue receivables ageing",
      severity: "opportunity",
      detectedAt: "2026-02-18T07:15:40+05:30",
      headline: `${formatShortINR(receivables.value)} across ${receivables.count} invoices`,
      detail: `${receivables.count} invoices are past due by an average of ${receivables.avgDaysOverdue} days. Collection probability falls sharply after day 60.`,
      impact: receivables.value,
      recoverable: C.ANOMALY_LEDGER.receivables.recoverable,
      confidence: 0.79,
      observedValue: receivables.avgDaysOverdue,
      baselineValue: 30,
      unit: "days",
      affectedCount: receivables.count,
      metricLabel: "Average days overdue",
    },
    {
      id: "anm_checkout_drop",
      kind: "checkout_drop",
      title: "Checkout conversion drop",
      severity: "watch",
      detectedAt: "2026-02-18T15:02:55+05:30",
      headline: `${formatShortINR(checkout.abandonedValue)} across ${checkout.abandonedCount} abandoned sessions`,
      detail: `Conversion fell from ${formatPercent(checkout.baselineConversion)} to ${formatPercent(checkout.conversion)}. Drop-off is concentrated at payment-method selection, immediately downstream of the UPI failures.`,
      impact: checkout.abandonedValue,
      recoverable: C.ANOMALY_LEDGER.checkout_drop.recoverable,
      confidence: 0.76,
      observedValue: checkout.conversion,
      baselineValue: checkout.baselineConversion,
      unit: "percent",
      affectedCount: checkout.abandonedCount,
      investigationId: "inv_1044",
      metricLabel: "Checkout conversion",
    },
    {
      id: "anm_chargeback_exposure",
      kind: "chargeback_exposure",
      title: "Chargeback exposure open",
      severity: "watch",
      detectedAt: "2026-02-17T18:22:10+05:30",
      headline: `${formatShortINR(chargebacks.exposure)} disputed, ${chargebacks.openCount} still representable`,
      detail: `${chargebacks.openCount} disputes are inside the representment window. Evidence bundles can be assembled from the order and delivery records already on file.`,
      impact: chargebacks.exposure,
      recoverable: C.ANOMALY_LEDGER.chargeback_exposure.recoverable,
      confidence: 0.72,
      observedValue: chargebacks.exposure,
      baselineValue: 24_000,
      unit: "inr",
      affectedCount: chargebacks.chargebacks.length,
      metricLabel: "Open dispute value",
    },
    {
      id: "anm_settlement_discrepancy",
      kind: "settlement_discrepancy",
      title: "Settlement discrepancy",
      severity: "watch",
      detectedAt: "2026-02-18T06:40:18+05:30",
      headline: `${formatShortINR(settlement.varianceAmount)} unreconciled`,
      detail: `Settlement ${settlement.discrepancy?.utr ?? ""} landed ${formatShortINR(settlement.varianceAmount)} short of the captured total after fees and tax. Timing is normal at ${m.settlementDelayDays.toFixed(1)} days, so this is a value gap rather than a delay.`,
      impact: settlement.varianceAmount,
      recoverable: C.ANOMALY_LEDGER.settlement_discrepancy.recoverable,
      confidence: 0.84,
      observedValue: settlement.varianceAmount,
      baselineValue: 0,
      unit: "inr",
      affectedCount: 1,
      investigationId: "inv_1045",
      metricLabel: "Unreconciled variance",
    },
  ];

  return anomalies;
}

/** Anomalies that count toward the revenue-at-risk rollup, highest impact first. */
export function getRiskLedger(): Anomaly[] {
  return detectAnomalies()
    .filter((a) => !DERIVED_ANOMALIES.has(a.id))
    .sort((a, b) => b.impact - a.impact);
}

/** The three cards the command centre leads with. */
export function getAttentionCards(): Anomaly[] {
  const all = detectAnomalies();
  const byId = new Map(all.map((a) => [a.id, a]));
  return ["anm_upi_degradation", "anm_recoverable_failures", "anm_refund_spike"]
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}

/** Prioritised worklist, ranked by financial impact. */
export function getPriorities(): Anomaly[] {
  return detectAnomalies()
    .filter((a) => !DERIVED_ANOMALIES.has(a.id) && a.id !== "anm_chargeback_exposure" && a.id !== "anm_receivables")
    .sort((a, b) => b.impact - a.impact);
}

export function getAnomaly(id: string): Anomaly | undefined {
  return detectAnomalies().find((a) => a.id === id);
}
