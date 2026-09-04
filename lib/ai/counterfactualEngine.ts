import * as C from "@/lib/demo/config";
import { getIncidentStats } from "@/lib/analytics/metrics";
import type { Scenario } from "@/lib/types";

/**
 * Counterfactual engine — stage 5 of the loop.
 *
 * Before anything is recommended, every candidate intervention (including
 * doing nothing) is scored on the same three quantities:
 *
 *   expected recovery  = at-risk value × modelled conversion rate
 *   expected cost      = unit cost × the number of attempts or contacts
 *   net expected benefit = recovery − cost
 *
 * "Do nothing" is scored as a *loss*, which is what makes the comparison
 * meaningful: inaction is a decision with a price, and the merchant sees it.
 */

export interface ScenarioInput {
  atRisk: number;
  cohortSize: number;
  reachableCustomers: number;
  retryRecoveryRate: number;
  alternateRecoveryRate: number;
  doNothingLossRate: number;
  retryCostPerAttempt: number;
  retryAttempts: number;
  alternateCostPerCustomer: number;
  doNothingProbability: number;
  labels: { retry: string; alternate: string; retryDetail: string; alternateDetail: string };
  linkedActions: { retry?: string; alternate?: string };
}

export function scoreScenarios(input: ScenarioInput): Scenario[] {
  const doNothingLoss = Math.round(input.atRisk * input.doNothingLossRate);
  const retryRecovery = Math.round(input.atRisk * input.retryRecoveryRate);
  const retryCost = Math.round(input.cohortSize * input.retryAttempts * input.retryCostPerAttempt);
  const altRecovery = Math.round(input.atRisk * input.alternateRecoveryRate);
  const altCost = Math.round(input.cohortSize * input.alternateCostPerCustomer);

  const scenarios: Scenario[] = [
    {
      id: "scn_a",
      key: "do_nothing",
      name: "Do nothing",
      description:
        "Let the rail recover on its own. No customer is contacted and no payment is re-attempted.",
      expectedRecovery: 0,
      expectedCost: 0,
      expectedAdditionalLoss: doNothingLoss,
      netExpectedBenefit: -doNothingLoss,
      probability: input.doNothingProbability,
      customerContactRisk: "none",
      reachableCustomers: 0,
      recommended: false,
      assumptions: [
        `${Math.round(input.doNothingLossRate * 100)}% of at-risk value does not return on its own, measured on this merchant's own past failure cohorts.`,
        "Customers who abandon after a failed payment rarely re-attempt the same rail the same day.",
        "No cost, no contact risk — the entire exposure stays open.",
      ],
    },
    {
      id: "scn_b",
      key: "retry",
      name: input.labels.retry,
      description: input.labels.retryDetail,
      expectedRecovery: retryRecovery,
      expectedCost: retryCost,
      expectedAdditionalLoss: 0,
      netExpectedBenefit: retryRecovery - retryCost,
      probability: input.retryRecoveryRate,
      customerContactRisk: "low",
      reachableCustomers: input.cohortSize,
      recommended: false,
      linkedActionId: input.linkedActions.retry,
      assumptions: [
        `Conversion modelled at ${(input.retryRecoveryRate * 100).toFixed(1)}% because the retry lands on the same degraded rail.`,
        `Cost of ₹${input.retryCostPerAttempt.toFixed(2)} per attempt × ${input.retryAttempts} attempts × ${input.cohortSize.toLocaleString("en-IN")} payments.`,
        "Bounded by MAX_RETRY_ATTEMPTS = 2; no third attempt is possible.",
      ],
    },
    {
      id: "scn_c",
      key: "alternate_method",
      name: input.labels.alternate,
      description: input.labels.alternateDetail,
      expectedRecovery: altRecovery,
      expectedCost: altCost,
      expectedAdditionalLoss: 0,
      netExpectedBenefit: altRecovery - altCost,
      probability: input.alternateRecoveryRate,
      customerContactRisk: "medium",
      reachableCustomers: input.reachableCustomers,
      recommended: false,
      linkedActionId: input.linkedActions.alternate,
      assumptions: [
        `Conversion modelled at ${(input.alternateRecoveryRate * 100).toFixed(1)}% because the customer is routed away from the failing rail.`,
        `Cost of ₹${input.alternateCostPerCustomer.toFixed(2)} per contacted customer × ${input.cohortSize.toLocaleString("en-IN")}.`,
        "One contact per customer; no incentive attached, so MAX_DISCOUNT_PERCENT is not engaged.",
      ],
    },
  ];

  // Recommend the highest net expected benefit. Ties go to the lower contact risk.
  const best = scenarios.reduce((a, b) =>
    b.netExpectedBenefit > a.netExpectedBenefit ? b : a,
  );
  best.recommended = true;
  return scenarios;
}

/** Scenarios for the UPI degradation investigation. */
export function upiScenarios(): Scenario[] {
  const stats = getIncidentStats();
  return scoreScenarios({
    atRisk: stats.atRisk,
    cohortSize: stats.affected,
    reachableCustomers: stats.highIntentCount,
    retryRecoveryRate: C.RETRY_RECOVERY_RATE,
    alternateRecoveryRate: C.ALTERNATE_RECOVERY_RATE,
    doNothingLossRate: C.DO_NOTHING_LOSS_RATE,
    retryCostPerAttempt: C.RETRY_COST_PER_ATTEMPT,
    retryAttempts: C.RETRY_ATTEMPTS_PER_TXN,
    alternateCostPerCustomer: C.ALTERNATE_COST_PER_CUSTOMER,
    doNothingProbability: C.DO_NOTHING_PROBABILITY,
    labels: {
      retry: "Retry failed payments",
      alternate: "Offer alternate payment method",
      retryDetail:
        "Re-present the failed UPI collect requests to the same issuer, within the retry ceiling.",
      alternateDetail:
        "Send the affected customers a payment link that routes to card or netbanking instead of the degraded UPI rail.",
    },
    linkedActions: { retry: "act_2040", alternate: "act_2041" },
  });
}
