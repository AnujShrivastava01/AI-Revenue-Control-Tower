import * as C from "@/lib/demo/config";
import { getIncidentStats, getRefundStats, getCheckoutStats, getSettlementStats } from "@/lib/analytics/metrics";
import { upiScenarios } from "./counterfactualEngine";
import { formatShortINR, formatPercent } from "@/lib/utils";
import type { ActionPlan, Recommendation } from "@/lib/types";

/**
 * Decision engine — stage 6 of the loop.
 *
 * Turns the winning counterfactual into a *bounded action plan*: an explicit
 * cohort, an explicit per-customer ceiling, an explicit attempt ceiling and a
 * named policy. The plan is data, not an instruction — nothing executes until
 * it clears the policy engine and, where required, a human.
 */

const ALTERNATE_SUCCESS = C.RECOVERY_MEAN_HIGH_INTENT * C.ALTERNATE_METHOD_UPLIFT; // 0.74

export function getActions(): ActionPlan[] {
  const incident = getIncidentStats();
  const refunds = getRefundStats();
  const checkout = getCheckoutStats();
  const settlement = getSettlementStats();

  const cohort = incident.highIntentCount;
  const exposure = incident.highIntentValue;

  return [
    {
      id: "act_2041",
      investigationId: "inv_1042",
      scenarioKey: "alternate_method",
      kind: "alternate_method_offer",
      title: "Offer alternate payment method",
      description: `Send ${cohort} affected customers a payment link that routes to card or netbanking, bypassing the degraded UPI rail. One contact per customer, no incentive attached.`,
      status: "pending_approval",
      createdAt: "2026-02-18T14:37:02+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: cohort,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: exposure,
      expectedRecovery: Math.round(exposure * ALTERNATE_SUCCESS),
      successProbability: ALTERNATE_SUCCESS,
      risk: "medium",
      requiresApproval: true,
      rationale: `These ${cohort} customers show high purchase intent — each is a repeat buyer whose payment failed on a rail that is degraded, not on funds or authentication. Routing them to a working rail converts at ${formatPercent(ALTERNATE_SUCCESS, 0)} in this merchant's own history, against ${formatPercent(C.RECOVERY_MEAN_HIGH_INTENT, 0)} for an unassisted re-attempt.`,
      guardrails: [
        { label: "Cohort", value: `${cohort} customers, one contact each` },
        { label: "Per-customer ceiling", value: "₹5,000" },
        { label: "Attempts", value: "1 of 1" },
        { label: "Incentive", value: "None — MAX_DISCOUNT_PERCENT not engaged" },
        { label: "Rail", value: "Card / netbanking only; UPI excluded" },
      ],
      demoOutcome: "success",
    },
    {
      id: "act_2040",
      investigationId: "inv_1042",
      scenarioKey: "retry",
      kind: "payment_retry",
      title: "Retry failed UPI payments",
      description: `Re-present the failed UPI collect requests for the ${cohort}-customer high-intent cohort to the same issuer. One automatic attempt has already been spent during the incident.`,
      status: "pending_approval",
      createdAt: "2026-02-18T14:36:48+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: cohort,
      maxAmountPerCustomer: 5000,
      maxAttempts: C.RETRY_ATTEMPTS_PER_TXN,
      attemptsUsed: 1,
      totalExposure: exposure,
      expectedRecovery: Math.round(exposure * C.RETRY_RECOVERY_RATE),
      successProbability: C.RETRY_RECOVERY_RATE,
      risk: "medium",
      requiresApproval: true,
      rationale:
        "A retry is the cheapest intervention available and needs no customer contact. Its weakness is that it lands on the same issuer that is currently degraded, so conversion is modelled well below the alternate-rail option.",
      guardrails: [
        { label: "Cohort", value: `${cohort} failed payments` },
        { label: "Per-customer ceiling", value: "₹5,000" },
        { label: "Attempts", value: `1 of ${C.RETRY_ATTEMPTS_PER_TXN} already spent` },
        { label: "Rail", value: "Same issuer — Bank X UPI" },
        { label: "On failure", value: "Halt; do not re-queue" },
      ],
      demoOutcome: "temporary_failure",
      fallbackActionId: "act_2041",
    },
    {
      id: "act_2042",
      investigationId: "inv_1043",
      scenarioKey: "alternate_method",
      kind: "refund_hold",
      title: `Hold auto-refunds on ${refunds.product.sku} pending quality review`,
      description: `Route refund requests for ${refunds.product.name} to manual review instead of auto-approval, and attach the batch identifier to each case so the source of the defect can be isolated.`,
      status: "pending_approval",
      createdAt: "2026-02-18T08:11:30+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: refunds.refundCount,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: C.ANOMALY_LEDGER.refund_spike.impact,
      expectedRecovery: C.ANOMALY_LEDGER.refund_spike.recoverable,
      successProbability: 0.6,
      risk: "medium",
      requiresApproval: true,
      rationale:
        "Auto-approving refunds on a SKU with a doubled return rate converts a product problem into a cash problem. Manual review costs a day of handling time and preserves the evidence needed to decide whether this is a batch defect or a listing error.",
      guardrails: [
        { label: "Scope", value: `${refunds.product.sku} only` },
        { label: "Customer impact", value: "Refund still honoured; approval moves to same-day manual" },
        { label: "Duration", value: "72 hours, then auto-expires" },
        { label: "Escalation", value: "Any case older than 24h auto-approves" },
      ],
      demoOutcome: "success",
    },
    {
      id: "act_2043",
      investigationId: "inv_1044",
      scenarioKey: "alternate_method",
      kind: "alternate_method_offer",
      title: "Reorder checkout methods for Bank X customers",
      description: `Present card and netbanking above UPI at method selection for customers whose last attempt failed at Bank X. Affects ${checkout.abandonedCount} live sessions.`,
      status: "pending_approval",
      createdAt: "2026-02-18T15:04:12+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: checkout.abandonedCount,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: checkout.abandonedValue,
      expectedRecovery: C.ANOMALY_LEDGER.checkout_drop.recoverable,
      successProbability: 0.6,
      risk: "low",
      requiresApproval: false,
      rationale:
        "Method ordering is a presentation change with no money movement and no customer contact. It is reversible in one click and expires automatically when the issuer recovers.",
      guardrails: [
        { label: "Scope", value: "Bank X customers with a failed attempt in the last 2 hours" },
        { label: "Money movement", value: "None" },
        { label: "Reversal", value: "Immediate" },
        { label: "Auto-expiry", value: "When issuer success rate returns above 95%" },
      ],
      demoOutcome: "success",
    },
    {
      id: "act_2044",
      investigationId: "inv_1045",
      scenarioKey: "alternate_method",
      kind: "settlement_reconcile",
      title: `Raise reconciliation request for ${settlement.discrepancy?.utr ?? "settlement"}`,
      description: `File a reconciliation request for the ${formatShortINR(settlement.varianceAmount)} gap between captured value and settled value on this cycle, with the matched transaction list attached.`,
      status: "pending_approval",
      createdAt: "2026-02-18T06:44:01+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: 0,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: settlement.varianceAmount,
      expectedRecovery: settlement.varianceAmount,
      successProbability: 0.81,
      risk: "low",
      requiresApproval: false,
      rationale:
        "The variance is a single cycle and the transaction-level match is complete, so the request can be filed with evidence rather than as an open query. No customer is affected.",
      guardrails: [
        { label: "Scope", value: "One settlement cycle" },
        { label: "Customer impact", value: "None" },
        { label: "Evidence", value: "Transaction-level match attached" },
      ],
      demoOutcome: "success",
    },

    {
      id: "act_2045",
      investigationId: "inv_1047",
      scenarioKey: "alternate_method",
      kind: "duplicate_refund",
      title: "Auto-refund all duplicate captures",
      description: `Refund the second capture on all ${C.DUPLICATE_CHARGE.pairs} duplicate pairs, matched exactly to the original order amount, before any customer disputes the charge.`,
      status: "pending_approval",
      createdAt: "2026-02-18T11:56:40+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: C.DUPLICATE_CHARGE.pairs,
      maxAmountPerCustomer: 2500,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: C.ANOMALY_LEDGER.duplicate_charge.impact,
      expectedRecovery: C.ANOMALY_LEDGER.duplicate_charge.recoverable,
      successProbability: 1,
      risk: "medium",
      requiresApproval: true,
      rationale:
        "Refunding proactively costs exactly the amount already wrongly captured. Waiting risks the same amount plus chargeback fees and dispute handling once customers notice on their own statements.",
      guardrails: [
        { label: "Scope", value: `${C.DUPLICATE_CHARGE.pairs} matched duplicate pairs only` },
        { label: "Amount", value: "Refund equals the duplicate capture, to the paisa" },
        { label: "Customer impact", value: "One unsolicited refund notification, no action needed from them" },
        { label: "Evidence", value: "Timeout + retry log attached to every pair" },
      ],
      demoOutcome: "success",
    },
    {
      id: "act_2046",
      investigationId: "inv_1046",
      scenarioKey: "alternate_method",
      kind: "fraud_block",
      title: "Block flagged profiles and require step-up verification",
      description: `Block the ${C.CARD_TESTING.newProfiles} flagged profiles outright and require CVV plus 3-D Secure step-up for any new profile's first card attempt.`,
      status: "pending_approval",
      createdAt: "2026-02-18T13:09:30+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: C.CARD_TESTING.newProfiles,
      maxAmountPerCustomer: 0,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: C.ANOMALY_LEDGER.card_testing.impact,
      expectedRecovery: C.ANOMALY_LEDGER.card_testing.recoverable,
      successProbability: 0.97,
      risk: "medium",
      requiresApproval: true,
      rationale:
        "The pattern is unambiguous, but blocking real customer profiles by mistake has its own cost, so a human confirms before the block is applied rather than the system silently locking accounts.",
      guardrails: [
        { label: "Scope", value: `${C.CARD_TESTING.newProfiles} flagged profiles` },
        { label: "Money movement", value: "None — no capture has succeeded above ₹58" },
        { label: "Step-up", value: "CVV + 3-D Secure on next new-profile card attempt" },
        { label: "Reversal", value: "Any wrongly blocked profile can be restored in one click" },
      ],
      demoOutcome: "success",
    },

    // ---- Completed history -------------------------------------------------
    {
      id: "act_2031",
      investigationId: "inv_1039",
      scenarioKey: "alternate_method",
      kind: "alternate_method_offer",
      title: "Alternate payment offer — 12 Feb cohort",
      description: "Routed 96 customers away from a degraded netbanking rail during the 12 February incident.",
      status: "completed",
      createdAt: "2026-02-12T11:20:03+05:30",
      approvedAt: "2026-02-12T11:26:44+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: 96,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 1,
      totalExposure: 121_400,
      expectedRecovery: 79_100,
      successProbability: 0.65,
      risk: "medium",
      requiresApproval: true,
      rationale: "Same pattern as today, different issuer. Retained as the reference case for the recovery model.",
      guardrails: [{ label: "Cohort", value: "96 customers" }],
      demoOutcome: "success",
      result: {
        actionId: "act_2031",
        ok: true,
        at: "2026-02-12T11:31:09+05:30",
        code: "RECOVERY_COMPLETED",
        message: "84,200 recovered against a modelled 79,100.",
        recoveredAmount: 84_200,
        attempted: 96,
        succeeded: 64,
        failed: 32,
        gateway: "razorpay_mock_adapter",
        verification: {
          checkedAt: "2026-02-12T11:41:09+05:30",
          checks: [
            { label: "Ledger delta matches action scope", passed: true, detail: "+₹84,200 across 64 payments" },
            { label: "No customer contacted twice", passed: true, detail: "96 unique recipients" },
            { label: "No payment exceeded per-customer ceiling", passed: true, detail: "max ₹4,780" },
          ],
          ledgerDelta: 84_200,
          verdict: "verified",
        },
      },
    },
    {
      id: "act_2028",
      investigationId: "inv_1037",
      scenarioKey: "alternate_method",
      kind: "alternate_method_offer",
      title: "Blanket 15% recovery discount",
      description: "Proposed a 15% incentive across all failed payments in the 09 February cohort.",
      status: "rejected",
      createdAt: "2026-02-09T16:02:40+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: 211,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 0,
      totalExposure: 268_900,
      expectedRecovery: 141_300,
      successProbability: 0.53,
      risk: "high",
      requiresApproval: true,
      rationale: "Rejected by the merchant: margin impact was not worth the incremental conversion.",
      guardrails: [{ label: "Discount", value: "15% — above MAX_DISCOUNT_PERCENT" }],
      demoOutcome: "success",
    },
    {
      id: "act_2026",
      investigationId: "inv_1036",
      scenarioKey: "retry",
      kind: "payment_retry",
      title: "Retry 640-customer failed cohort",
      description: "Automatic retry proposed across the entire 07 February failure cohort.",
      status: "blocked_by_policy",
      createdAt: "2026-02-07T13:44:55+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: 640,
      maxAmountPerCustomer: 5000,
      maxAttempts: 2,
      attemptsUsed: 0,
      totalExposure: 402_100,
      expectedRecovery: 141_800,
      successProbability: 0.35,
      risk: "medium",
      requiresApproval: true,
      rationale: "Blocked before approval: cohort size exceeded the blast-radius ceiling.",
      guardrails: [{ label: "Cohort", value: "640 customers — above MAX_CUSTOMERS_PER_ACTION" }],
      demoOutcome: "success",
    },
    {
      id: "act_2019",
      investigationId: "inv_1031",
      scenarioKey: "alternate_method",
      kind: "settlement_reconcile",
      title: "Chargeback representment bundle",
      description: "Assembled and filed evidence for 7 disputes inside the representment window.",
      status: "completed",
      createdAt: "2026-02-03T10:12:00+05:30",
      approvedAt: "2026-02-03T10:19:31+05:30",
      createdBy: "decision_engine",
      policyId: "RECOVERY_V2",
      targetCustomers: 0,
      maxAmountPerCustomer: 5000,
      maxAttempts: 1,
      attemptsUsed: 1,
      totalExposure: 47_800,
      expectedRecovery: 28_600,
      successProbability: 0.6,
      risk: "low",
      requiresApproval: false,
      rationale: "Documentary evidence already on file; no customer impact.",
      guardrails: [{ label: "Scope", value: "7 disputes" }],
      demoOutcome: "success",
      result: {
        actionId: "act_2019",
        ok: true,
        at: "2026-02-03T10:24:02+05:30",
        code: "REPRESENTMENT_FILED",
        message: "7 representments filed; 5 later resolved in the merchant's favour.",
        recoveredAmount: 31_400,
        attempted: 7,
        succeeded: 5,
        failed: 2,
        gateway: "razorpay_mock_adapter",
        verification: {
          checkedAt: "2026-02-06T09:00:00+05:30",
          checks: [
            { label: "Dispute status reconciled", passed: true, detail: "5 of 7 reversed" },
            { label: "Ledger delta matches", passed: true, detail: "+₹31,400" },
          ],
          ledgerDelta: 31_400,
          verdict: "verified",
        },
      },
    },
  ];
}

export function getAction(id: string): ActionPlan | undefined {
  return getActions().find((a) => a.id === id);
}

/** The recommendation attached to an investigation. */
export function getRecommendation(investigationId: string): Recommendation {
  if (investigationId === "inv_1042") {
    const scenarios = upiScenarios();
    const best = scenarios.find((s) => s.recommended)!;
    const doNothing = scenarios.find((s) => s.key === "do_nothing")!;
    const retry = scenarios.find((s) => s.key === "retry")!;
    return {
      id: "rec_1042",
      investigationId,
      scenarioKey: best.key,
      statement: best.name,
      reason: `Highest expected net recovery with controlled customer-contact risk. ${formatShortINR(best.netExpectedBenefit)} net against ${formatShortINR(retry.netExpectedBenefit)} for a retry on the same degraded rail, and ${formatShortINR(doNothing.expectedAdditionalLoss)} of further loss if nothing is done.`,
      generatedBy: "deterministic_decision_engine",
      linkedActionId: best.linkedActionId ?? "act_2041",
    };
  }
  const map: Record<string, { action: string; statement: string; reason: string }> = {
    inv_1043: {
      action: "act_2042",
      statement: "Hold auto-refunds pending quality review",
      reason:
        "Stops the cash bleed without denying any customer a refund, and preserves the batch evidence needed to find the cause.",
    },
    inv_1044: {
      action: "act_2043",
      statement: "Reorder checkout methods for affected customers",
      reason:
        "Presentation-only change, no money movement, immediately reversible — the cheapest intervention that addresses the observed drop-off point.",
    },
    inv_1045: {
      action: "act_2044",
      statement: "File a reconciliation request with matched evidence",
      reason:
        "The transaction-level match is complete, so this can be filed as an evidenced claim rather than an open query.",
    },
    inv_1046: {
      action: "act_2046",
      statement: "Block flagged profiles and require step-up verification",
      reason:
        "Stops the attack at the source with no money movement, while leaving a human to confirm before any profile is actually blocked.",
    },
    inv_1047: {
      action: "act_2045",
      statement: "Auto-refund all duplicate captures",
      reason:
        "Refunding now costs exactly what was wrongly taken; waiting risks the same amount again in chargeback fees once customers notice.",
    },
  };
  const entry = map[investigationId] ?? map.inv_1043;
  return {
    id: `rec_${investigationId.slice(4)}`,
    investigationId,
    scenarioKey: "alternate_method",
    statement: entry.statement,
    reason: entry.reason,
    generatedBy: "deterministic_decision_engine",
    linkedActionId: entry.action,
  };
}
