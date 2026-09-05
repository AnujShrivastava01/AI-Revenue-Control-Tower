import * as C from "@/lib/demo/config";
import { getDataset } from "@/lib/demo/dataset";
import {
  getCheckoutStats,
  getIncidentStats,
  getRefundStats,
  getSettlementStats,
} from "@/lib/analytics/metrics";
import { getAnomaly } from "./anomalyDetector";
import { scoreScenarios, upiScenarios } from "./counterfactualEngine";
import { getRecommendation } from "./decisionEngine";
import { formatINR, formatPercent, formatShortINR, timeIST } from "@/lib/utils";
import type { EvidenceItem, Investigation, Scenario, TimelineEntry } from "@/lib/types";

/**
 * Investigator — stage 4 of the loop.
 *
 * Takes a detected anomaly and assembles an evidence-backed case: which
 * transactions, which segments, which competing hypotheses were considered and
 * why they were rejected. Confidence is reported as a number, and every claim
 * on the page is traceable to rows in the ledger.
 */

const INVESTIGATION_IDS = ["inv_1042", "inv_1043", "inv_1044", "inv_1045", "inv_1046", "inv_1047"] as const;

function upiInvestigation(): Investigation {
  const ds = getDataset();
  const s = getIncidentStats();
  const anomaly = getAnomaly("anm_upi_degradation")!;
  const scenarios = upiScenarios();

  const evidenceTxns = C.PLANTED_EVIDENCE.map((p) => ds.byId.get(p.id)).filter(Boolean);

  const evidence: EvidenceItem[] = [
    ...evidenceTxns.map((t, i) => ({
      id: `evd_txn_${i + 1}`,
      investigationId: "inv_1042",
      kind: "transaction" as const,
      label: t!.id,
      transactionId: t!.id,
      weight: 1 - i * 0.04,
      summary: `${formatINR(t!.amount)} · ${t!.method.toUpperCase()} · ${t!.device} · ${t!.bank} · failed at ${timeIST(t!.createdAt)}`,
      facts: [
        { label: "Transaction", value: t!.id, mono: true },
        { label: "Amount", value: formatINR(t!.amount) },
        { label: "Method", value: t!.method.toUpperCase() },
        { label: "Device", value: t!.device },
        { label: "Bank", value: t!.bank === "BANKX" ? "Bank X" : t!.bank },
        { label: "Status", value: "Failed" },
        { label: "Error", value: t!.errorCode ?? "—", mono: true },
      ],
    })),
    {
      id: "evd_agg_bank",
      investigationId: "inv_1042",
      kind: "aggregate",
      label: "Issuer concentration",
      weight: 0.98,
      summary: `${formatPercent(s.bankShare, 0)} of the ${s.affected.toLocaleString("en-IN")} affected failures involve Bank X, against a ${formatPercent(s.bankBaselineShare, 0)} baseline share of failures.`,
      facts: [
        { label: "Affected failures", value: s.affected.toLocaleString("en-IN"), mono: true },
        { label: "Bank X failures", value: s.segments[0].incidentCount.toLocaleString("en-IN"), mono: true },
        { label: "Incident share", value: formatPercent(s.bankShare, 0) },
        { label: "Baseline share", value: formatPercent(s.bankBaselineShare, 0) },
        { label: "Concentration", value: `${s.concentrationMultiple.toFixed(1)}×` },
      ],
    },
    {
      id: "evd_agg_method",
      investigationId: "inv_1042",
      kind: "aggregate",
      label: "Method and device cut",
      weight: 0.92,
      summary: `${formatPercent(s.upiShare, 0)} of affected failures are UPI and ${formatPercent(s.androidShare, 0)} originate on Android. Card and netbanking success is unchanged.`,
      facts: [
        { label: "UPI share", value: formatPercent(s.upiShare, 0) },
        { label: "Android share", value: formatPercent(s.androidShare, 0) },
        { label: "Card success today", value: "97.6%" },
        { label: "Netbanking success today", value: "97.1%" },
      ],
    },
    {
      id: "evd_ts_success",
      investigationId: "inv_1042",
      kind: "timeseries",
      label: "Success rate, 20-minute buckets",
      weight: 0.95,
      summary: `Success held at ${formatPercent(s.preSuccessRate)} until 09:12, then fell away, reaching its trough of ${formatPercent(s.acuteSuccessRate)} inside the 14:30–16:10 window.`,
      facts: [
        { label: "Before 09:12", value: formatPercent(s.preSuccessRate) },
        { label: "Since 09:12", value: formatPercent(s.eventSuccessRate) },
        { label: "14:30 – 16:10 trough", value: formatPercent(s.acuteSuccessRate) },
        { label: "Learned baseline", value: formatPercent(C.BASELINE.successRate) },
      ],
    },
    {
      id: "evd_agg_value",
      investigationId: "inv_1042",
      kind: "comparison",
      label: "Value skew",
      weight: 0.7,
      summary: `Affected payments average ${formatINR(s.avgAffectedValue)} against a captured average of ${formatINR(s.avgCapturedValue)} — the failures skew ${(s.avgAffectedValue / s.avgCapturedValue).toFixed(1)}× above the merchant's normal order value.`,
      facts: [
        { label: "Average affected", value: formatINR(s.avgAffectedValue) },
        { label: "Average captured", value: formatINR(s.avgCapturedValue) },
        { label: "Skew", value: `${(s.avgAffectedValue / s.avgCapturedValue).toFixed(2)}×` },
        { label: "Reading", value: "Higher-value collect requests are timing out first" },
      ],
    },
  ];

  const timeline: TimelineEntry[] = [
    { at: "2026-02-18T14:32:11+05:30", actor: "ai", label: "Payment degradation detected", detail: "Failure rate crossed the learned band for the 6th consecutive bucket" },
    { at: "2026-02-18T14:33:04+05:30", actor: "ai", label: "AI began investigation", detail: "Investigation inv_1042 opened, severity provisional" },
    { at: "2026-02-18T14:34:12+05:30", actor: "ai", label: "Payment methods segmented", detail: "UPI isolated; card and netbanking cleared" },
    { at: "2026-02-18T14:35:01+05:30", actor: "ai", label: "Bank-level pattern identified", detail: `Bank X carries ${formatPercent(s.bankShare, 0)} of failures against a ${formatPercent(s.bankBaselineShare, 0)} baseline` },
    { at: "2026-02-18T14:36:20+05:30", actor: "ai", label: "Revenue impact calculated", detail: `${formatShortINR(s.atRisk)} at risk, ${formatShortINR(s.recoverable)} modelled recoverable` },
    { at: "2026-02-18T14:37:02+05:30", actor: "ai", label: "Recovery strategy generated", detail: "Three scenarios scored; alternate-rail offer recommended" },
  ];

  return {
    id: "inv_1042",
    anomalyId: anomaly.id,
    title: "UPI payment degradation",
    status: "action_pending",
    severity: "critical",
    impact: s.atRisk,
    recoverable: s.recoverable,
    confidence: 0.91,
    openedAt: "2026-02-18T14:33:04+05:30",
    affectedCount: s.affected,
    summary: `Payment success rate dropped from ${formatPercent(s.preSuccessRate)} to ${formatPercent(s.eventSuccessRate)} after 09:12. The decline is concentrated in UPI transactions from Android devices involving Bank X, and is at its worst between 14:30 and 16:10. Card and netbanking are unaffected, and UPI's share of customer attempts has not moved — so this is a fulfilment failure on one issuer's rail, not a change in customer behaviour.`,
    metrics: [
      { label: "Transactions affected", value: s.affected.toLocaleString("en-IN"), sub: `${s.acuteCount.toLocaleString("en-IN")} inside 14:30–16:10` },
      { label: "Revenue at risk", value: formatShortINR(s.atRisk), sub: formatINR(s.atRisk), tone: "danger" },
      { label: "Estimated recoverable", value: formatShortINR(s.recoverable), sub: `${formatPercent(s.recoverableRate, 0)} of exposure`, tone: "ok" },
      { label: "Confidence", value: "82%", sub: "on the recovery estimate" },
    ],
    evidence,
    rootCause: {
      statement: "Bank X UPI degradation",
      mechanism:
        "Collect requests routed to Bank X are timing out before the customer can approve them. The issuer is accepting the request and then failing to respond inside the 30-second window, which the gateway reports as a timeout rather than a decline. Higher-value requests fail first, which is consistent with issuer-side risk checks queueing behind a saturated service.",
      observedShare: s.bankShare,
      baselineShare: s.bankBaselineShare,
      shareLabel: "Share of failures involving Bank X",
      supportingEvidenceIds: ["evd_agg_bank", "evd_ts_success", "evd_agg_method", "evd_agg_value"],
      alternativesConsidered: [
        {
          hypothesis: "Merchant-side checkout regression",
          verdict: "Rejected",
          rejectedBecause: "Card success is 97.6% and netbanking 97.1% today — a checkout regression would not spare two rails.",
        },
        {
          hypothesis: "Customer-side balance or authentication failures",
          verdict: "Rejected",
          rejectedBecause: `${formatPercent(0.86, 0)} of affected error codes are timeouts or gateway errors; INSUFFICIENT_FUNDS and AUTH_FAILED are flat against baseline.`,
        },
        {
          hypothesis: "Traffic composition shift toward UPI",
          verdict: "Rejected",
          rejectedBecause: `UPI's share of attempts is ${formatPercent(0.61, 0)} against a ${formatPercent(C.BASELINE.upiMix, 0)} baseline — customers have not changed rail.`,
        },
        {
          hypothesis: "Android app release regression",
          verdict: "Rejected",
          rejectedBecause: "Android carries 88% of affected failures but also 58% of all traffic; iOS Bank X payments fail at the same elevated rate.",
        },
      ],
    },
    timeline,
    scenarios,
    recommendation: getRecommendation("inv_1042"),
    segmentBreakdown: s.segments.map((seg) => ({
      label: seg.label,
      incident: seg.incidentShare,
      baseline: seg.baselineShare,
    })),
    successRateSeries: s.successSeries,
  };
}

function refundInvestigation(): Investigation {
  const ds = getDataset();
  const r = getRefundStats();
  const anomaly = getAnomaly("anm_refund_spike")!;
  const refunds = ds.refunds
    .filter((x) => x.productId === C.ANOMALOUS_PRODUCT_ID)
    .slice(0, 6);

  const scenarios: Scenario[] = scoreScenarios({
    atRisk: C.ANOMALY_LEDGER.refund_spike.impact,
    cohortSize: r.refundCount,
    reachableCustomers: r.refundCount,
    retryRecoveryRate: 0.32,
    alternateRecoveryRate: 0.6,
    doNothingLossRate: 0.71,
    retryCostPerAttempt: 6.2,
    retryAttempts: 1,
    alternateCostPerCustomer: 18.4,
    doNothingProbability: 0.74,
    labels: {
      retry: "Tighten the returns window",
      alternate: "Hold auto-refunds for quality review",
      retryDetail: "Reduce the no-questions returns window on this SKU from 14 days to 7.",
      alternateDetail:
        "Route refund requests on this SKU to same-day manual review and attach the batch identifier to each case.",
    },
    linkedActions: { alternate: "act_2042" },
  });

  return {
    id: "inv_1043",
    anomalyId: anomaly.id,
    title: `Refund spike — ${r.product.name}`,
    status: "investigating",
    severity: "watch",
    impact: C.ANOMALY_LEDGER.refund_spike.impact,
    recoverable: C.ANOMALY_LEDGER.refund_spike.recoverable,
    confidence: 0.88,
    openedAt: "2026-02-18T08:05:20+05:30",
    affectedCount: r.refundCount,
    summary: `The refund rate on ${r.product.name} (${r.product.sku}) moved from ${formatPercent(r.baselineRate)} to ${formatPercent(r.currentRate)} nine days ago and has not returned. No other SKU moved in the same period, and delivery times are unchanged, which points at the product or its listing rather than at fulfilment.`,
    metrics: [
      { label: "Refunds on SKU", value: String(r.refundCount), sub: "today" },
      { label: "Excess refund value", value: formatShortINR(C.ANOMALY_LEDGER.refund_spike.impact), sub: "over 9 days vs baseline", tone: "danger" },
      { label: "Rate", value: formatPercent(r.currentRate), sub: `baseline ${formatPercent(r.baselineRate)}`, tone: "warn" },
      { label: "Confidence", value: "88%" },
    ],
    evidence: [
      {
        id: "evd_refund_rate",
        investigationId: "inv_1043",
        kind: "comparison",
        label: "Rate step-change",
        weight: 0.96,
        summary: `Stable at ${formatPercent(r.baselineRate)} for 33 days, then a step to ${formatPercent(r.currentRate)} that has held for 9.`,
        facts: [
          { label: "Baseline window", value: "33 days" },
          { label: "Baseline rate", value: formatPercent(r.baselineRate) },
          { label: "Current rate", value: formatPercent(r.currentRate) },
          { label: "Other SKUs", value: "No movement" },
        ],
      },
      {
        id: "evd_refund_reason",
        investigationId: "inv_1043",
        kind: "aggregate",
        label: "Reason mix",
        weight: 0.88,
        summary: `"${r.topReason}" now accounts for the majority of refunds on this SKU, up from roughly a third.`,
        facts: [
          { label: "Leading reason", value: r.topReason },
          { label: "Share", value: "55%" },
          { label: "Previously", value: "31%" },
          { label: "Delivery-related reasons", value: "Flat" },
        ],
      },
      ...refunds.map((rf, i) => ({
        id: `evd_refund_${i}`,
        investigationId: "inv_1043",
        kind: "transaction" as const,
        label: rf.id,
        transactionId: rf.transactionId,
        weight: 0.6 - i * 0.03,
        summary: `${formatINR(rf.amount)} refunded · ${rf.reason} · ${timeIST(rf.createdAt)}`,
        facts: [
          { label: "Refund", value: rf.id, mono: true },
          { label: "Transaction", value: rf.transactionId, mono: true },
          { label: "Amount", value: formatINR(rf.amount) },
          { label: "Reason", value: rf.reason },
          { label: "Status", value: rf.status },
        ],
      })),
    ],
    rootCause: {
      statement: "Product or listing defect concentrated in one SKU",
      mechanism:
        "Refund reasons shifted toward \"item not as described\" while delivery-related reasons stayed flat. That combination separates a product or listing problem from a logistics problem. The step-change is sharp rather than gradual, which is characteristic of a single manufacturing batch or a listing edit rather than slow quality drift.",
      observedShare: r.currentRate,
      baselineShare: r.baselineRate,
      shareLabel: "Refund rate on this SKU",
      supportingEvidenceIds: ["evd_refund_rate", "evd_refund_reason"],
      alternativesConsidered: [
        { hypothesis: "Delivery network degradation", verdict: "Rejected", rejectedBecause: "Delivery-related refund reasons are flat and no other SKU moved." },
        { hypothesis: "Refund policy change", verdict: "Rejected", rejectedBecause: "Policy applies merchant-wide; the merchant-wide refund rate is unchanged." },
        { hypothesis: "Seasonal returns", verdict: "Rejected", rejectedBecause: "No comparable step in the same week of prior months for this category." },
      ],
    },
    timeline: [
      { at: "2026-02-18T08:04:02+05:30", actor: "ai", label: "Refund rate breached learned band", detail: "9th consecutive day above the 42-day band" },
      { at: "2026-02-18T08:05:20+05:30", actor: "ai", label: "Investigation opened", detail: "inv_1043" },
      { at: "2026-02-18T08:07:44+05:30", actor: "ai", label: "SKU isolated", detail: "No other SKU outside its band" },
      { at: "2026-02-18T08:09:10+05:30", actor: "ai", label: "Reason mix analysed", detail: "\"Item not as described\" 31% → 55%" },
      { at: "2026-02-18T08:11:30+05:30", actor: "ai", label: "Containment action drafted", detail: "act_2042 awaiting approval" },
    ],
    scenarios,
    recommendation: getRecommendation("inv_1043"),
    segmentBreakdown: [
      { label: "Item not as described", incident: 0.55, baseline: 0.31 },
      { label: "Damaged on arrival", incident: 0.3, baseline: 0.26 },
      { label: "Delivery delay", incident: 0.09, baseline: 0.24 },
      { label: "Changed mind", incident: 0.06, baseline: 0.19 },
    ],
    successRateSeries: ds.daily.slice(-21).map((d) => ({
      t: d.label,
      rate: d.anomalousProductRefundRate,
      baseline: C.BASELINE.refundRate,
    })),
  };
}

function checkoutInvestigation(): Investigation {
  const ck = getCheckoutStats();
  const anomaly = getAnomaly("anm_checkout_drop")!;
  const sessions = ck.abandoned.slice(0, 6);

  const scenarios = scoreScenarios({
    atRisk: ck.abandonedValue,
    cohortSize: ck.abandonedCount,
    reachableCustomers: ck.abandonedCount,
    retryRecoveryRate: 0.28,
    alternateRecoveryRate: 0.6,
    doNothingLossRate: 0.82,
    retryCostPerAttempt: 3.1,
    retryAttempts: 1,
    alternateCostPerCustomer: 0,
    doNothingProbability: 0.81,
    labels: {
      retry: "Send an abandoned-cart reminder",
      alternate: "Reorder payment methods at checkout",
      retryDetail: "Email the abandoned sessions a link back to the same checkout, unchanged.",
      alternateDetail:
        "Present card and netbanking above UPI for customers whose last attempt failed at Bank X. No money movement, immediately reversible.",
    },
    linkedActions: { alternate: "act_2043" },
  });

  return {
    id: "inv_1044",
    anomalyId: anomaly.id,
    title: "Checkout conversion drop",
    status: "investigating",
    severity: "watch",
    impact: ck.abandonedValue,
    recoverable: C.ANOMALY_LEDGER.checkout_drop.recoverable,
    confidence: 0.76,
    openedAt: "2026-02-18T15:03:30+05:30",
    affectedCount: ck.abandonedCount,
    summary: `Checkout conversion fell from ${formatPercent(ck.baselineConversion)} to ${formatPercent(ck.conversion)} today. Drop-off is concentrated at payment-method selection rather than at cart or contact, and the affected sessions cluster behind customers who had just seen a UPI failure — this is downstream of inv_1042, not an independent problem.`,
    metrics: [
      { label: "Abandoned sessions", value: String(ck.abandonedCount), sub: `of ${ck.total} started` },
      { label: "Value at stake", value: formatShortINR(ck.abandonedValue), tone: "warn" },
      { label: "Conversion", value: formatPercent(ck.conversion), sub: `baseline ${formatPercent(ck.baselineConversion)}` },
      { label: "Confidence", value: "76%" },
    ],
    evidence: [
      {
        id: "evd_checkout_stage",
        investigationId: "inv_1044",
        kind: "aggregate",
        label: "Drop-off stage",
        weight: 0.94,
        summary: "74% of abandonments occur at or after payment-method selection; cart and contact stages are unchanged.",
        facts: [
          { label: "Method selection", value: "38%" },
          { label: "Authentication", value: "36%" },
          { label: "Contact", value: "14%" },
          { label: "Cart", value: "12%" },
        ],
      },
      {
        id: "evd_checkout_link",
        investigationId: "inv_1044",
        kind: "comparison",
        label: "Correlation with inv_1042",
        weight: 0.86,
        summary: "Abandonment rate rises and falls with the Bank X UPI failure rate within the same 20-minute buckets.",
        facts: [
          { label: "Bucket correlation", value: "0.79" },
          { label: "Lag", value: "0 – 20 minutes" },
          { label: "Reading", value: "Downstream of the payment incident" },
        ],
      },
      ...sessions.map((s, i) => ({
        id: `evd_session_${i}`,
        investigationId: "inv_1044",
        kind: "transaction" as const,
        label: s.id,
        weight: 0.5 - i * 0.03,
        summary: `${formatINR(s.amount)} · abandoned at ${s.stage.replace("_", " ")} · ${timeIST(s.createdAt)}`,
        facts: [
          { label: "Session", value: s.id, mono: true },
          { label: "Value", value: formatINR(s.amount) },
          { label: "Stage", value: s.stage.replace("_", " ") },
          { label: "Reason", value: s.dropOffReason ?? "—" },
          { label: "Started", value: timeIST(s.createdAt), mono: true },
        ],
      })),
    ],
    rootCause: {
      statement: "Abandonment downstream of the Bank X UPI failures",
      mechanism:
        "Customers reach method selection, choose UPI, see a failure, and leave rather than switching rails themselves. The checkout offers no prompt to try another method after a failure, so the recovery depends entirely on customer initiative.",
      observedShare: 1 - ck.conversion,
      baselineShare: 1 - ck.baselineConversion,
      shareLabel: "Session abandonment rate",
      supportingEvidenceIds: ["evd_checkout_stage", "evd_checkout_link"],
      alternativesConsidered: [
        { hypothesis: "Pricing or shipping objection", verdict: "Rejected", rejectedBecause: "Cart-stage abandonment is flat; drop-off starts after price is already accepted." },
        { hypothesis: "Checkout page performance", verdict: "Rejected", rejectedBecause: "Page load and interaction timings are within their normal range all day." },
      ],
    },
    timeline: [
      { at: "2026-02-18T15:02:55+05:30", actor: "ai", label: "Conversion breached learned band", detail: "3rd consecutive 20-minute bucket" },
      { at: "2026-02-18T15:03:30+05:30", actor: "ai", label: "Investigation opened", detail: "inv_1044" },
      { at: "2026-02-18T15:03:58+05:30", actor: "ai", label: "Funnel segmented by stage", detail: "Method selection isolated" },
      { at: "2026-02-18T15:04:12+05:30", actor: "ai", label: "Linked to inv_1042", detail: "Bucket correlation 0.79" },
    ],
    scenarios,
    recommendation: getRecommendation("inv_1044"),
    segmentBreakdown: [
      { label: "Method selection", incident: 0.38, baseline: 0.19 },
      { label: "Authentication", incident: 0.36, baseline: 0.22 },
      { label: "Contact", incident: 0.14, baseline: 0.28 },
      { label: "Cart", incident: 0.12, baseline: 0.31 },
    ],
    successRateSeries: getIncidentStats().successSeries.map((p) => ({
      t: p.t,
      rate: p.rate,
      baseline: ck.baselineConversion,
    })),
  };
}

function settlementInvestigation(): Investigation {
  const st = getSettlementStats();
  const anomaly = getAnomaly("anm_settlement_discrepancy")!;
  const d = st.discrepancy;

  const scenarios = scoreScenarios({
    atRisk: st.varianceAmount,
    cohortSize: 1,
    reachableCustomers: 0,
    retryRecoveryRate: 0.4,
    alternateRecoveryRate: 0.81,
    doNothingLossRate: 1,
    retryCostPerAttempt: 0,
    retryAttempts: 1,
    alternateCostPerCustomer: 0,
    doNothingProbability: 0.9,
    labels: {
      retry: "Wait for the next cycle to self-correct",
      alternate: "File a reconciliation request with evidence",
      retryDetail: "Some variances clear automatically when a late capture settles in the following cycle.",
      alternateDetail: "Submit the transaction-level match as an evidenced reconciliation claim.",
    },
    linkedActions: { alternate: "act_2044" },
  });

  return {
    id: "inv_1045",
    anomalyId: anomaly.id,
    title: "Settlement discrepancy",
    status: "investigating",
    severity: "watch",
    impact: st.varianceAmount,
    recoverable: st.varianceAmount,
    confidence: 0.84,
    openedAt: "2026-02-18T06:41:02+05:30",
    affectedCount: 1,
    summary: `Settlement ${d?.utr ?? ""} landed ${formatShortINR(st.varianceAmount)} below the captured total once fees and tax are accounted for. Settlement timing is normal at 1.4 days, so this is a value gap rather than a delay, and it is isolated to a single cycle.`,
    metrics: [
      { label: "Unreconciled variance", value: formatShortINR(st.varianceAmount), tone: "warn" },
      { label: "Cycles affected", value: "1", sub: "of 14 reviewed" },
      { label: "Settlement timing", value: "1.4 days", sub: "baseline 1.3 days" },
      { label: "Confidence", value: "84%" },
    ],
    evidence: [
      {
        id: "evd_settle_match",
        investigationId: "inv_1045",
        kind: "comparison",
        label: "Captured vs settled",
        weight: 0.95,
        summary: `Captured value less fees and tax exceeds the settled amount by ${formatShortINR(st.varianceAmount)}.`,
        facts: [
          { label: "UTR", value: d?.utr ?? "—", mono: true },
          { label: "Settled", value: formatINR(d?.amount ?? 0) },
          { label: "Fees", value: formatINR(d?.fees ?? 0) },
          { label: "Tax", value: formatINR(d?.tax ?? 0) },
          { label: "Variance", value: formatINR(st.varianceAmount) },
        ],
      },
      {
        id: "evd_settle_scope",
        investigationId: "inv_1045",
        kind: "aggregate",
        label: "Scope check",
        weight: 0.8,
        summary: "The other 13 cycles in the review window reconcile exactly, so this is not a systematic fee or tax mismatch.",
        facts: [
          { label: "Cycles reviewed", value: "14" },
          { label: "Reconciled exactly", value: "13" },
          { label: "Variance cycles", value: "1" },
        ],
      },
    ],
    rootCause: {
      statement: "Single-cycle value gap, transaction match complete",
      mechanism:
        "The transaction-level match accounts for every captured payment in the cycle, and the fee and tax computation reconciles against the published rate. The gap is therefore in the payout leg rather than in capture or fee calculation, which makes it a reconciliation claim rather than an accounting correction.",
      observedShare: 1 / 14,
      baselineShare: 0,
      shareLabel: "Cycles with unreconciled variance",
      supportingEvidenceIds: ["evd_settle_match", "evd_settle_scope"],
      alternativesConsidered: [
        { hypothesis: "Fee schedule change", verdict: "Rejected", rejectedBecause: "Effective rate is 2.03% in this cycle and in the 13 that reconcile." },
        { hypothesis: "Late capture rolled to the next cycle", verdict: "Open", rejectedBecause: "Would self-correct next cycle; the reconciliation request preserves the claim either way." },
      ],
    },
    timeline: [
      { at: "2026-02-18T06:40:18+05:30", actor: "ai", label: "Settlement variance detected", detail: "Automated UTR match" },
      { at: "2026-02-18T06:41:02+05:30", actor: "ai", label: "Investigation opened", detail: "inv_1045" },
      { at: "2026-02-18T06:42:30+05:30", actor: "ai", label: "Transaction match completed", detail: "All captures accounted for" },
      { at: "2026-02-18T06:44:01+05:30", actor: "ai", label: "Reconciliation request drafted", detail: "act_2044 awaiting approval" },
    ],
    scenarios,
    recommendation: getRecommendation("inv_1045"),
    segmentBreakdown: [
      { label: "Reconciled cycles", incident: 13 / 14, baseline: 1 },
      { label: "Variance cycles", incident: 1 / 14, baseline: 0 },
    ],
    successRateSeries: st.settlements
      .slice()
      .reverse()
      .map((s) => ({
        t: s.utr.slice(-4),
        rate: s.varianceAmount === 0 ? 1 : 1 - Math.abs(s.varianceAmount) / Math.max(1, s.amount),
        baseline: 1,
      })),
  };
}

function cardTestingInvestigation(): Investigation {
  const anomaly = getAnomaly("anm_card_testing")!;
  const ct = C.CARD_TESTING;
  const skew = ct.normalCardAvgAmount / ct.avgAttemptedAmount;

  const scenarios = scoreScenarios({
    atRisk: C.ANOMALY_LEDGER.card_testing.impact,
    cohortSize: ct.attempts,
    reachableCustomers: ct.newProfiles,
    retryRecoveryRate: 0.55,
    alternateRecoveryRate: 0.97,
    doNothingLossRate: 1,
    retryCostPerAttempt: 0,
    retryAttempts: 1,
    alternateCostPerCustomer: 0,
    doNothingProbability: 0.9,
    labels: {
      retry: "Rate-limit new-profile card attempts",
      alternate: "Block cohort and require step-up verification",
      retryDetail: "Cap card authorization attempts per new profile to 3 per hour, slowing the bot without affecting genuine repeat customers.",
      alternateDetail: `Block the ${ct.newProfiles} flagged profiles outright and require CVV plus 3-D Secure step-up for any new profile's first card attempt.`,
    },
    linkedActions: { alternate: "act_2046" },
  });

  return {
    id: "inv_1046",
    anomalyId: anomaly.id,
    title: "Card testing attack",
    status: "action_pending",
    severity: "critical",
    impact: C.ANOMALY_LEDGER.card_testing.impact,
    recoverable: C.ANOMALY_LEDGER.card_testing.recoverable,
    confidence: 0.95,
    openedAt: "2026-02-18T13:06:10+05:30",
    affectedCount: ct.attempts,
    summary: `${ct.attempts} card authorizations, averaging ₹${ct.avgAttemptedAmount}, arrived from ${ct.newProfiles} customer profiles never seen before, all within an 18-minute window starting 12:47 IST. ${formatPercent(ct.declineRate, 0)} were declined by the issuer before completion. The amount, velocity and decline pattern match a bot validating a list of stolen card numbers rather than real purchases.`,
    metrics: [
      { label: "Attempts flagged", value: ct.attempts.toLocaleString("en-IN"), sub: "18-minute window" },
      { label: "Exposure if unblocked", value: formatShortINR(C.ANOMALY_LEDGER.card_testing.impact), tone: "danger" },
      { label: "Decline rate", value: formatPercent(ct.declineRate, 0), sub: `baseline ${formatPercent(ct.baselineDeclineRate, 1)}` },
      { label: "Confidence", value: "95%" },
    ],
    evidence: [
      {
        id: "evd_ct_velocity",
        investigationId: "inv_1046",
        kind: "aggregate",
        label: "Attempt velocity",
        weight: 0.97,
        summary: "One authorization attempt every 5 seconds during the burst, against a normal cadence of one every 40 seconds.",
        facts: [
          { label: "Burst window", value: "12:47 – 13:05 IST" },
          { label: "Attempts", value: String(ct.attempts), mono: true },
          { label: "Normal cadence", value: "~1 per 40s" },
          { label: "Burst cadence", value: "~1 per 5s" },
        ],
      },
      {
        id: "evd_ct_profile",
        investigationId: "inv_1046",
        kind: "aggregate",
        label: "Profile age",
        weight: 0.94,
        summary: `${ct.newProfiles} of ${ct.attempts} attempts came from customer profiles created in the last hour, with no prior order history.`,
        facts: [
          { label: "New profiles", value: `${ct.newProfiles} of ${ct.attempts} (${formatPercent(ct.newProfiles / ct.attempts, 0)})` },
          { label: "Prior order history", value: "None" },
          { label: "Shipping address provided", value: "4% of attempts" },
        ],
      },
      {
        id: "evd_ct_amount",
        investigationId: "inv_1046",
        kind: "comparison",
        label: "Value skew",
        weight: 0.9,
        summary: `Average attempted value ₹${ct.avgAttemptedAmount}, against this merchant's normal card order value of ₹${ct.normalCardAvgAmount} — a ${skew.toFixed(1)}× drop consistent with balance-testing micro-charges.`,
        facts: [
          { label: "Average attempted", value: `₹${ct.avgAttemptedAmount}` },
          { label: "Normal average", value: `₹${ct.normalCardAvgAmount}` },
          { label: "Skew", value: `${skew.toFixed(1)}× below normal` },
        ],
      },
      {
        id: "evd_ct_decline",
        investigationId: "inv_1046",
        kind: "aggregate",
        label: "Decline outcome",
        weight: 0.88,
        summary: `${formatPercent(ct.declineRate, 0)} of attempts were declined at the issuer before completion; only ${ct.authorized} authorized, all under ₹${ct.largestAuthorized + 2}.`,
        facts: [
          { label: "Declined", value: `${ct.declined} of ${ct.attempts} (${formatPercent(ct.declineRate, 0)})` },
          { label: "Authorized", value: String(ct.authorized) },
          { label: "Largest authorized", value: `₹${ct.largestAuthorized}` },
          { label: "Decline codes", value: "CARD_DECLINED, INVALID_CVV" },
        ],
      },
    ],
    rootCause: {
      statement: "Automated card-testing bot probing stolen card numbers",
      mechanism:
        "The velocity, new-profile concentration and micro-amount pattern match how stolen card numbers are validated before the working ones are used for a larger purchase elsewhere. The checkout is being used as a free validation service, not as a real storefront.",
      observedShare: ct.declineRate,
      baselineShare: ct.baselineDeclineRate,
      shareLabel: "Card decline rate during the burst",
      supportingEvidenceIds: ["evd_ct_velocity", "evd_ct_profile", "evd_ct_amount", "evd_ct_decline"],
      alternativesConsidered: [
        { hypothesis: "Marketing campaign driving low-value trial purchases", verdict: "Rejected", rejectedBecause: "No campaign is live, and 96% of attempts have no shipping address, so there is nothing to deliver." },
        { hypothesis: "Payment gateway misconfiguration", verdict: "Rejected", rejectedBecause: "UPI and netbanking attempts in the same window show a normal decline rate; only the card rail is affected." },
        { hypothesis: "Legitimate customers using expired or cancelled cards", verdict: "Rejected", rejectedBecause: "Decline codes are dominated by CARD_DECLINED and INVALID_CVV, not EXPIRED_CARD, and attempts share no other legitimate pattern." },
      ],
    },
    timeline: [
      { at: "2026-02-18T13:05:44+05:30", actor: "ai", label: "Decline-rate spike detected", detail: "Card decline rate crossed the learned band for the merchant's card rail" },
      { at: "2026-02-18T13:06:10+05:30", actor: "ai", label: "AI began investigation", detail: "Investigation inv_1046 opened, severity provisional" },
      { at: "2026-02-18T13:07:20+05:30", actor: "ai", label: "Attempts segmented by profile age", detail: "189 of 214 attempts traced to profiles under 1 hour old" },
      { at: "2026-02-18T13:08:05+05:30", actor: "ai", label: "Velocity and amount pattern matched", detail: "Signature consistent with automated card testing" },
      { at: "2026-02-18T13:09:30+05:30", actor: "ai", label: "Block-and-verify action drafted", detail: "act_2046 awaiting approval" },
    ],
    scenarios,
    recommendation: getRecommendation("inv_1046"),
    segmentBreakdown: [
      { label: "Declined", incident: ct.declineRate, baseline: ct.baselineDeclineRate },
      { label: "New profiles", incident: ct.newProfiles / ct.attempts, baseline: 0.08 },
    ],
    successRateSeries: Array.from({ length: 6 }, (_, i) => ({
      t: `${12 + Math.floor((47 + i * 4) / 60)}:${String((47 + i * 4) % 60).padStart(2, "0")}`,
      rate: i === 0 ? 0.976 : Math.max(0.02, 0.976 - i * 0.19),
      baseline: 0.976,
    })),
  };
}

function duplicateChargeInvestigation(): Investigation {
  const anomaly = getAnomaly("anm_duplicate_charge")!;
  const dc = C.DUPLICATE_CHARGE;

  const scenarios = scoreScenarios({
    atRisk: C.ANOMALY_LEDGER.duplicate_charge.impact,
    cohortSize: dc.pairs,
    reachableCustomers: dc.pairs,
    retryRecoveryRate: 0.3,
    alternateRecoveryRate: 1,
    doNothingLossRate: 1,
    retryCostPerAttempt: 8,
    retryAttempts: 1,
    alternateCostPerCustomer: 15,
    doNothingProbability: 0.7,
    labels: {
      retry: "Wait for customers to self-report",
      alternate: "Auto-refund all duplicate captures",
      retryDetail: "Handle each duplicate only if the customer notices and contacts support.",
      alternateDetail: `Immediately refund the second capture on all ${dc.pairs} duplicate pairs, matched exactly to the original order amount.`,
    },
    linkedActions: { alternate: "act_2045" },
  });

  return {
    id: "inv_1047",
    anomalyId: anomaly.id,
    title: "Duplicate payment charges",
    status: "action_pending",
    severity: "critical",
    impact: C.ANOMALY_LEDGER.duplicate_charge.impact,
    recoverable: C.ANOMALY_LEDGER.duplicate_charge.recoverable,
    confidence: 0.97,
    openedAt: "2026-02-18T11:52:30+05:30",
    affectedCount: dc.pairs,
    summary: `Between 11:10 and 11:40 IST, ${dc.pairs} customers were charged twice for the same order. The checkout's retry logic re-submitted a payment after a gateway timeout without first checking whether the original attempt had already been captured, so both the timed-out attempt and the retry went through. Every affected pair shares the same customer, the same order amount, and a capture gap under 90 seconds.`,
    metrics: [
      { label: "Customers double-charged", value: String(dc.pairs) },
      { label: "Amount to refund", value: formatShortINR(C.ANOMALY_LEDGER.duplicate_charge.impact), tone: "danger" },
      { label: "Detection lag", value: "12 minutes", sub: "after the first duplicate" },
      { label: "Confidence", value: "97%" },
    ],
    evidence: [
      {
        id: "evd_dc_pairing",
        investigationId: "inv_1047",
        kind: "aggregate",
        label: "Pair match",
        weight: 0.98,
        summary: `Each of the ${dc.pairs} pairs matches on customer, amount and order reference, with the second capture landing 40 to 90 seconds after the first.`,
        facts: [
          { label: "Matched pairs", value: String(dc.pairs), mono: true },
          { label: "Same customer & amount", value: "100%" },
          { label: "Median gap", value: `${dc.medianGapSeconds} seconds` },
          { label: "Order reference match", value: "100%" },
        ],
      },
      {
        id: "evd_dc_trigger",
        investigationId: "inv_1047",
        kind: "aggregate",
        label: "Trigger condition",
        weight: 0.95,
        summary: "Every duplicate followed a gateway timeout response on the first attempt, which the checkout treated as a failure and retried automatically.",
        facts: [
          { label: "Preceded by gateway timeout", value: `${dc.pairs} of ${dc.pairs}` },
          { label: "Retry path", value: "checkout-retry v3.2", mono: true },
          { label: "Idempotency key checked", value: "No" },
        ],
      },
      {
        id: "evd_dc_window",
        investigationId: "inv_1047",
        kind: "aggregate",
        label: "Time window",
        weight: 0.85,
        summary: "All duplicate pairs occurred inside one 30-minute window, matching a single gateway slowdown rather than an ongoing pattern.",
        facts: [
          { label: "Window", value: "11:10 – 11:40 IST" },
          { label: "Pairs before window", value: "0" },
          { label: "Pairs after window", value: "0" },
        ],
      },
      ...dc.examples.map((ex, i) => ({
        id: `evd_dc_example_${i}`,
        investigationId: "inv_1047",
        kind: "comparison" as const,
        label: `${ex.order} captured twice`,
        weight: 0.6 - i * 0.05,
        summary: `${formatINR(ex.amount)} captured twice, ${ex.gapSeconds} seconds apart.`,
        facts: [
          { label: "Order", value: ex.order, mono: true },
          { label: "Amount", value: `${formatINR(ex.amount)} × 2` },
          { label: "First capture", value: timeIST(ex.firstAt), mono: true },
          { label: "Gap", value: `${ex.gapSeconds}s` },
        ],
      })),
    ],
    rootCause: {
      statement: "Checkout retry re-submitted a payment without an idempotency check",
      mechanism:
        "When the gateway responded slowly, the checkout's retry logic treated the timeout as a failed payment and resubmitted it automatically. It never checked whether the original request had already been captured on Razorpay's side, because the retry path does not carry an idempotency key. Both the original and the retry succeeded, so the customer was charged twice for one order.",
      observedShare: 1,
      baselineShare: 0,
      shareLabel: "Duplicate pairs missing an idempotency key",
      supportingEvidenceIds: ["evd_dc_pairing", "evd_dc_trigger"],
      alternativesConsidered: [
        { hypothesis: "Customer manually double-submitted the order", verdict: "Rejected", rejectedBecause: "Every pair is preceded by a logged gateway timeout, and the 40–90 second gap is too short and too consistent for manual resubmission." },
        { hypothesis: "Refund already issued and this is stale data", verdict: "Rejected", rejectedBecause: "None of the 42 duplicate captures have a matching refund on the ledger." },
        { hypothesis: "Pricing or tax recalculation created a second legitimate charge", verdict: "Rejected", rejectedBecause: "Both captures in every pair are for the identical amount, down to the paisa." },
      ],
    },
    timeline: [
      { at: "2026-02-18T11:41:10+05:30", actor: "ai", label: "Duplicate-capture pattern detected", detail: `${dc.pairs} same-customer, same-amount capture pairs inside 30 minutes` },
      { at: "2026-02-18T11:52:30+05:30", actor: "ai", label: "AI began investigation", detail: "Investigation inv_1047 opened" },
      { at: "2026-02-18T11:54:02+05:30", actor: "ai", label: "Retry path isolated", detail: "Missing idempotency key on checkout-retry v3.2 confirmed as the trigger" },
      { at: "2026-02-18T11:56:40+05:30", actor: "ai", label: "Refund plan drafted", detail: "act_2045 awaiting approval, one refund per affected customer" },
    ],
    scenarios,
    recommendation: getRecommendation("inv_1047"),
    segmentBreakdown: [
      { label: "Duplicate pairs missing idempotency key", incident: 1, baseline: 0 },
    ],
    successRateSeries: Array.from({ length: 6 }, (_, i) => ({
      t: `11:${String(10 + i * 6).padStart(2, "0")}`,
      rate: 1,
      baseline: 1,
    })),
  };
}

const BUILDERS: Record<string, () => Investigation> = {
  inv_1042: upiInvestigation,
  inv_1043: refundInvestigation,
  inv_1044: checkoutInvestigation,
  inv_1045: settlementInvestigation,
  inv_1046: cardTestingInvestigation,
  inv_1047: duplicateChargeInvestigation,
};

export function getInvestigation(id: string): Investigation | undefined {
  return BUILDERS[id]?.();
}

export function listInvestigations(): Investigation[] {
  return INVESTIGATION_IDS.map((id) => BUILDERS[id]()).sort((a, b) => b.impact - a.impact);
}
