import * as C from "@/lib/demo/config";
import { getDataset, DEMO_NOW_MS, DAY_START_MS, ONSET_MS, ACUTE_START_MS, ACUTE_END_MS, istTime } from "@/lib/demo/dataset";
import type { OverviewMetrics, Transaction } from "@/lib/types";

/** Sum of a numeric projection. */
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface SegmentCut {
  label: string;
  incidentShare: number;
  baselineShare: number;
  incidentCount: number;
}

export interface IncidentStats {
  affected: number;
  atRisk: number;
  recoverable: number;
  recoverableRate: number;
  highIntentCount: number;
  highIntentValue: number;
  highIntentRecoverable: number;
  preSuccessRate: number;
  eventSuccessRate: number;
  acuteSuccessRate: number;
  bankShare: number;
  bankBaselineShare: number;
  concentrationMultiple: number;
  upiShare: number;
  androidShare: number;
  acuteCount: number;
  avgAffectedValue: number;
  avgCapturedValue: number;
  segments: SegmentCut[];
  successSeries: { t: string; rate: number; baseline: number }[];
}

function shareOf(txns: Transaction[], predicate: (t: Transaction) => boolean): number {
  if (txns.length === 0) return 0;
  return txns.filter(predicate).length / txns.length;
}

/** All incident-level statistics, computed from the transaction ledger. */
export function getIncidentStats(): IncidentStats {
  const ds = getDataset();
  const incident = ds.incident;
  const all = ds.transactions;

  const pre = all.filter((t) => Date.parse(t.createdAt) < ONSET_MS);
  const event = all.filter((t) => Date.parse(t.createdAt) >= ONSET_MS);
  const acute = all.filter((t) => {
    const at = Date.parse(t.createdAt);
    return at >= ACUTE_START_MS && at <= ACUTE_END_MS;
  });
  const captured = all.filter((t) => t.status === "captured");
  const otherFailures = all.filter((t) => t.status === "failed" && !t.anomalyId);

  const atRisk = sum(incident.map((t) => t.amount));
  const recoverable = Math.round(sum(incident.map((t) => t.amount * (t.recoveryProbability ?? 0))));
  const hi = ds.highIntent;
  const highIntentValue = sum(hi.map((t) => t.amount));
  const highIntentRecoverable = Math.round(
    sum(hi.map((t) => t.amount * (t.recoveryProbability ?? 0))),
  );

  const bankShare = shareOf(incident, (t) => t.bank === C.BANKS[0].code);
  const bankBaselineShare = shareOf(otherFailures, (t) => t.bank === C.BANKS[0].code);

  const segments: SegmentCut[] = [
    {
      label: "Bank X",
      incidentShare: bankShare,
      baselineShare: bankBaselineShare,
      incidentCount: incident.filter((t) => t.bank === C.BANKS[0].code).length,
    },
    {
      label: "UPI",
      incidentShare: shareOf(incident, (t) => t.method === "upi"),
      baselineShare: shareOf(otherFailures, (t) => t.method === "upi"),
      incidentCount: incident.filter((t) => t.method === "upi").length,
    },
    {
      label: "Android",
      incidentShare: shareOf(incident, (t) => t.device === "android"),
      baselineShare: shareOf(otherFailures, (t) => t.device === "android"),
      incidentCount: incident.filter((t) => t.device === "android").length,
    },
    {
      label: "Acute window 14:30–16:10",
      incidentShare: incident.filter((t) => {
        const at = Date.parse(t.createdAt);
        return at >= ACUTE_START_MS && at <= ACUTE_END_MS;
      }).length / incident.length,
      baselineShare:
        otherFailures.filter((t) => {
          const at = Date.parse(t.createdAt);
          return at >= ACUTE_START_MS && at <= ACUTE_END_MS;
        }).length / Math.max(1, otherFailures.length),
      incidentCount: incident.filter((t) => {
        const at = Date.parse(t.createdAt);
        return at >= ACUTE_START_MS && at <= ACUTE_END_MS;
      }).length,
    },
  ];

  // 20-minute success-rate series across the day.
  const bucketMs = 20 * C.MS.minute;
  const buckets = new Map<number, { ok: number; total: number }>();
  for (const t of all) {
    const b = Math.floor((Date.parse(t.createdAt) - DAY_START_MS) / bucketMs);
    const cur = buckets.get(b) ?? { ok: 0, total: 0 };
    cur.total++;
    if (t.status === "captured") cur.ok++;
    buckets.set(b, cur);
  }
  const successSeries = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, v]) => ({
      t: istTime(DAY_START_MS + b * bucketMs),
      rate: v.total ? v.ok / v.total : 1,
      baseline: C.BASELINE.successRate,
    }));

  return {
    affected: incident.length,
    atRisk,
    recoverable,
    recoverableRate: atRisk ? recoverable / atRisk : 0,
    highIntentCount: hi.length,
    highIntentValue,
    highIntentRecoverable,
    preSuccessRate: shareOf(pre, (t) => t.status === "captured"),
    eventSuccessRate: shareOf(event, (t) => t.status === "captured"),
    acuteSuccessRate: shareOf(acute, (t) => t.status === "captured"),
    bankShare,
    bankBaselineShare,
    concentrationMultiple: bankBaselineShare ? bankShare / bankBaselineShare : 0,
    upiShare: shareOf(incident, (t) => t.method === "upi"),
    androidShare: shareOf(incident, (t) => t.device === "android"),
    acuteCount: segments[3].incidentCount,
    avgAffectedValue: incident.length ? atRisk / incident.length : 0,
    avgCapturedValue: captured.length ? sum(captured.map((t) => t.amount)) / captured.length : 0,
    segments,
    successSeries,
  };
}

/** Command-centre and dashboard totals. */
export function getOverviewMetrics(): OverviewMetrics {
  const ds = getDataset();
  const stats = getIncidentStats();
  const captured = ds.transactions.filter((t) => t.status === "captured");
  const failed = ds.transactions.filter((t) => t.status === "failed");

  const revenueAtRisk = sum(Object.values(C.ANOMALY_LEDGER).map((a) => a.impact));
  const potentialRecovery = sum(Object.values(C.ANOMALY_LEDGER).map((a) => a.recoverable));

  const hourly = new Map<number, { captured: number; failed: number; value: number }>();
  for (const t of ds.transactions) {
    const h = Math.floor((Date.parse(t.createdAt) - DAY_START_MS) / C.MS.hour);
    const cur = hourly.get(h) ?? { captured: 0, failed: 0, value: 0 };
    if (t.status === "captured") {
      cur.captured++;
      cur.value += t.amount;
    } else cur.failed++;
    hourly.set(h, cur);
  }

  const recentSettlements = ds.settlements.slice(0, 7);
  const settlementDelayDays =
    recentSettlements.reduce(
      (acc, s) =>
        acc + (s.settledAt ? (Date.parse(s.settledAt) - Date.parse(s.expectedAt)) / C.MS.day : 0),
      0,
    ) /
      Math.max(1, recentSettlements.length) +
    C.BASELINE.settlementDays;

  return {
    processedToday: sum(captured.map((t) => t.amount)),
    processedDelta: C.PROCESSED_DELTA,
    transactionsAnalyzed: ds.transactions.length,
    capturedCount: captured.length,
    failedCount: failed.length,
    refundCount: ds.refunds.length,
    refundValue: sum(ds.refunds.map((r) => r.amount)),
    revenueAtRisk,
    potentialRecovery,
    recovered: C.BATCH_TOTALS.recovered,
    anomaliesDetected: C.BATCH_TOTALS.anomaliesDetected,
    investigations: C.BATCH_TOTALS.investigations,
    actionsExecuted: C.BATCH_TOTALS.actionsExecuted,
    actionsBlocked: C.BATCH_TOTALS.actionsBlockedByPolicy,
    humanApprovals: C.BATCH_TOTALS.humanApprovals,
    avgTransactionValue: stats.avgCapturedValue,
    settlementDelayDays: Math.round(settlementDelayDays * 10) / 10,
    successRate: captured.length / ds.transactions.length,
    baselineSuccessRate: C.BASELINE.successRate,
    hourly: [...hourly.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, v]) => ({ hour: `${String(h).padStart(2, "0")}:00`, ...v })),
    daily: ds.daily.map((d) => ({
      day: d.day,
      label: d.label,
      revenue: d.revenue,
      refunds: d.refundValue,
      atRisk: d.atRisk,
    })),
  };
}

/** Refund-spike statistics for the anomalous product. */
export function getRefundStats() {
  const ds = getDataset();
  const product = ds.productById.get(C.ANOMALOUS_PRODUCT_ID)!;
  const productTxns = ds.transactions.filter(
    (t) => t.productId === C.ANOMALOUS_PRODUCT_ID && t.status === "captured",
  );
  const productRefunds = ds.refunds.filter((r) => r.productId === C.ANOMALOUS_PRODUCT_ID);
  const currentRate = productTxns.length ? productRefunds.length / productTxns.length : 0;
  const baselineRate = C.BASELINE.refundRate;
  const spikeDays = ds.daily.slice(-9);
  return {
    product,
    currentRate,
    baselineRate,
    refundCount: productRefunds.length,
    refundValue: sum(productRefunds.map((r) => r.amount)),
    spikeDays,
    excessRefundValue: C.ANOMALY_LEDGER.refund_spike.impact,
    topReason: "Item not as described",
  };
}

export function getCheckoutStats() {
  const ds = getDataset();
  const abandoned = ds.checkoutSessions.filter((s) => !s.completed);
  const completed = ds.checkoutSessions.filter((s) => s.completed);
  const conversion = completed.length / ds.checkoutSessions.length;
  return {
    abandoned,
    total: ds.checkoutSessions.length,
    completedCount: completed.length,
    abandonedCount: abandoned.length,
    abandonedValue: sum(abandoned.map((s) => s.amount)),
    conversion,
    baselineConversion: 0.938,
    topStage: "method_select" as const,
  };
}

export function getSettlementStats() {
  const ds = getDataset();
  const discrepancy = ds.settlements.find((s) => s.status === "discrepancy");
  return {
    settlements: ds.settlements,
    discrepancy,
    varianceAmount: Math.abs(discrepancy?.varianceAmount ?? 0),
  };
}

export function getReceivablesStats() {
  const ds = getDataset();
  const overdue = ds.invoices.filter((i) => i.status === "overdue");
  return {
    overdue,
    count: overdue.length,
    value: sum(overdue.map((i) => i.amount)),
    avgDaysOverdue: Math.round(
      overdue.reduce((a, i) => a + i.daysOverdue, 0) / Math.max(1, overdue.length),
    ),
  };
}

export function getChargebackStats() {
  const ds = getDataset();
  const open = ds.chargebacks.filter((c) => c.status === "open");
  return {
    chargebacks: ds.chargebacks,
    openCount: open.length,
    exposure: sum(ds.chargebacks.map((c) => c.amount)),
  };
}

export { DEMO_NOW_MS };
