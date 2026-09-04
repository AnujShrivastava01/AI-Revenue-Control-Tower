import * as C from "@/lib/demo/config";
import { getDataset } from "@/lib/demo/dataset";
import {
  getChargebackStats,
  getCheckoutStats,
  getIncidentStats,
  getOverviewMetrics,
  getReceivablesStats,
  getRefundStats,
  getSettlementStats,
} from "@/lib/analytics/metrics";

/**
 * Observer — stage 1 of the loop.
 *
 * Reduces the raw ledger into the small set of signals the detector compares
 * against Merchant Memory. Nothing here decides anything; it only measures.
 */
export interface Observation {
  key: string;
  label: string;
  value: number;
  unit: "percent" | "ratio" | "count" | "inr" | "days";
  window: string;
  sampleSize: number;
}

export interface ObservationSnapshot {
  takenAt: string;
  transactionsScanned: number;
  signalsEvaluated: number;
  observations: Observation[];
}

export function observe(): ObservationSnapshot {
  const ds = getDataset();
  const m = getOverviewMetrics();
  const incident = getIncidentStats();
  const refunds = getRefundStats();
  const checkout = getCheckoutStats();
  const settlement = getSettlementStats();
  const receivables = getReceivablesStats();
  const chargebacks = getChargebackStats();

  const observations: Observation[] = [
    {
      key: "failure_rate",
      label: "Payment failure rate",
      value: m.failedCount / m.transactionsAnalyzed,
      unit: "percent",
      window: "Today, 00:00 – 16:45 IST",
      sampleSize: m.transactionsAnalyzed,
    },
    {
      key: "success_rate_since_onset",
      label: "Success rate since 09:12",
      value: incident.eventSuccessRate,
      unit: "percent",
      window: "09:12 – 16:45 IST",
      sampleSize: C.EVENT_TRANSACTIONS,
    },
    {
      key: "bankx_failure_share",
      label: "Bank X share of failures",
      value: incident.bankShare,
      unit: "percent",
      window: "Incident cohort",
      sampleSize: incident.affected,
    },
    {
      key: "upi_mix",
      label: "UPI share of attempts",
      value: ds.daily[ds.daily.length - 1].upiMix,
      unit: "percent",
      window: "Today",
      sampleSize: m.transactionsAnalyzed,
    },
    {
      key: "product_refund_rate",
      label: `${refunds.product.name} refund rate`,
      value: refunds.currentRate,
      unit: "percent",
      window: "Last 9 days",
      sampleSize: 9_400,
    },
    {
      key: "checkout_conversion",
      label: "Checkout conversion",
      value: checkout.conversion,
      unit: "percent",
      window: "Today",
      sampleSize: checkout.total,
    },
    {
      key: "settlement_variance",
      label: "Unreconciled settlement variance",
      value: settlement.varianceAmount,
      unit: "inr",
      window: "Last 14 cycles",
      sampleSize: settlement.settlements.length,
    },
    {
      key: "settlement_delay",
      label: "Settlement delay",
      value: m.settlementDelayDays,
      unit: "days",
      window: "Last 7 cycles",
      sampleSize: 7,
    },
    {
      key: "receivables_overdue",
      label: "Overdue receivables",
      value: receivables.value,
      unit: "inr",
      window: "Open invoices",
      sampleSize: receivables.count,
    },
    {
      key: "chargeback_exposure",
      label: "Chargeback exposure",
      value: chargebacks.exposure,
      unit: "inr",
      window: "Last 12 days",
      sampleSize: chargebacks.chargebacks.length,
    },
  ];

  return {
    takenAt: C.DEMO_NOW,
    transactionsScanned: m.transactionsAnalyzed,
    signalsEvaluated: C.BATCH_TOTALS.anomaliesDetected,
    observations,
  };
}
