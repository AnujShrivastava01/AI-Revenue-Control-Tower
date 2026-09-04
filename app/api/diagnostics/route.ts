import { NextResponse } from "next/server";
import { getDataset } from "@/lib/demo/dataset";
import { getIncidentStats, getOverviewMetrics } from "@/lib/analytics/metrics";
import { getMode } from "@/lib/razorpay/client";
import { getAiStatus } from "@/lib/ai/llm";
import { POLICY_LIMITS } from "@/lib/policies/policyEngine";
import { getRefundStats, getCheckoutStats, getReceivablesStats, getChargebackStats, getSettlementStats } from "@/lib/analytics/metrics";

export const dynamic = "force-dynamic";

/**
 * Self-check for the seeded batch. Useful when changing the generator: every
 * assertion below is a number the product displays somewhere.
 */
export function GET() {
  const ds = getDataset();
  const s = getIncidentStats();
  const m = getOverviewMetrics();
  const held = ds.incident.filter((t) => t.amount > POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT);

  return NextResponse.json({
    gateway: getMode(),
    ai: getAiStatus(),
    batch: {
      transactions: ds.transactions.length,
      captured: m.capturedCount,
      failed: m.failedCount,
      processedToday: m.processedToday,
      avgCaptured: Math.round(s.avgCapturedValue),
      refunds: ds.refunds.length,
      customers: ds.customers.length,
      settlements: ds.settlements.length,
      checkoutSessions: ds.checkoutSessions.length,
      invoices: ds.invoices.length,
      dailyRows: ds.daily.length,
    },
    incident: {
      affected: s.affected,
      atRisk: s.atRisk,
      recoverable: s.recoverable,
      recoverableRate: Number(s.recoverableRate.toFixed(4)),
      highIntentCount: s.highIntentCount,
      highIntentValue: s.highIntentValue,
      highIntentRecoverable: s.highIntentRecoverable,
      preSuccessRate: Number(s.preSuccessRate.toFixed(4)),
      eventSuccessRate: Number(s.eventSuccessRate.toFixed(4)),
      acuteSuccessRate: Number(s.acuteSuccessRate.toFixed(4)),
      bankShare: Number(s.bankShare.toFixed(4)),
      bankBaselineShare: Number(s.bankBaselineShare.toFixed(4)),
      concentration: Number(s.concentrationMultiple.toFixed(2)),
      upiShare: Number(s.upiShare.toFixed(4)),
      androidShare: Number(s.androidShare.toFixed(4)),
      acuteCount: s.acuteCount,
      heldForManualApproval: { count: held.length, value: held.reduce((a, t) => a + t.amount, 0) },
      maxHighIntentAmount: Math.max(...ds.highIntent.map((t) => t.amount)),
    },
    rollup: {
      revenueAtRisk: m.revenueAtRisk,
      potentialRecovery: m.potentialRecovery,
      recovered: m.recovered,
      upiMixToday: ds.daily[ds.daily.length - 1].upiMix,
      settlementDelayDays: m.settlementDelayDays,
    },
    others: {
      refundRate: Number(getRefundStats().currentRate.toFixed(4)),
      refundBaseline: getRefundStats().baselineRate,
      refundCount: getRefundStats().refundCount,
      checkoutConversion: Number(getCheckoutStats().conversion.toFixed(4)),
      abandoned: getCheckoutStats().abandonedCount,
      abandonedValue: getCheckoutStats().abandonedValue,
      overdueCount: getReceivablesStats().count,
      overdueValue: getReceivablesStats().value,
      chargebackExposure: getChargebackStats().exposure,
      settlementVariance: getSettlementStats().varianceAmount,
      lastSundayRevenue: ds.daily.filter((d) => d.weekday === 0).slice(-1)[0]?.revenue,
    },
  });
}
