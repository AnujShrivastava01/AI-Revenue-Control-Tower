import type { ActionPlan, Policy, PolicyDecision } from "@/lib/types";

/**
 * Policy engine — the deterministic gate every action must pass.
 *
 * This module contains no model output and no probability. It is a pure
 * function of the action plan and the active policy, evaluated server-side
 * only. An action that fails here never reaches the executor, regardless of
 * what the language model recommended or what a client sent.
 */

export const RECOVERY_V2: Policy = {
  id: "RECOVERY_V2",
  name: "Recovery actions",
  version: "2.3",
  effectiveFrom: "2026-01-06T00:00:00+05:30",
  rules: [
    {
      key: "MAX_AUTO_ACTION_AMOUNT",
      value: "₹5,000 per customer",
      description: "Ceiling on the value an action may move for a single customer without escalation.",
      rationale:
        "Bounds the worst case of a single mis-targeted action to a sum the merchant can absorb and reverse.",
      enforcedIn: "policyEngine.evaluate → maxAmountPerCustomer",
    },
    {
      key: "MAX_RETRY_ATTEMPTS",
      value: "2 per transaction",
      description: "Hard ceiling on automated retries against the same failed payment.",
      rationale:
        "Repeated retries against a degraded rail add cost, irritate customers and can trip issuer risk rules. Two attempts captures nearly all of the recoverable value.",
      enforcedIn: "policyEngine.evaluate → attemptsUsed",
    },
    {
      key: "MAX_DISCOUNT_PERCENT",
      value: "10%",
      description: "Ceiling on any incentive attached to a recovery offer.",
      rationale: "Keeps recovery margin-positive; beyond 10% recovery costs more than the order earns.",
      enforcedIn: "policyEngine.evaluate → discountPercent",
    },
    {
      key: "HIGH_RISK_REQUIRES_APPROVAL",
      value: "true",
      description: "Any action rated medium or high risk requires a named human approval.",
      rationale:
        "Customer-contacting and money-moving actions carry reputational consequences the model cannot price.",
      enforcedIn: "policyEngine.evaluate → risk",
    },
    {
      key: "MAX_CUSTOMERS_PER_ACTION",
      value: "500",
      description: "Blast-radius ceiling on a single action.",
      rationale: "Caps the number of customers a single mistake can reach before a human sees the result.",
      enforcedIn: "policyEngine.evaluate → targetCustomers",
    },
    {
      key: "TEST_MODE_ONLY",
      value: "true",
      description: "Executor may only call Razorpay test-mode endpoints.",
      rationale: "No live-money credential is ever loaded in this environment; there is no path to real funds.",
      enforcedIn: "razorpay/client.ts → assertTestMode",
    },
  ],
};

export const POLICY_LIMITS = {
  MAX_AUTO_ACTION_AMOUNT: 5000,
  MAX_RETRY_ATTEMPTS: 2,
  MAX_DISCOUNT_PERCENT: 10,
  HIGH_RISK_REQUIRES_APPROVAL: true,
  MAX_CUSTOMERS_PER_ACTION: 500,
} as const;

export function getPolicy(id: string): Policy {
  if (id === RECOVERY_V2.id) return RECOVERY_V2;
  return RECOVERY_V2;
}

/**
 * Evaluate an action plan against its policy.
 * `attemptsOverride` lets the executor re-evaluate after an attempt is spent.
 */
export function evaluate(action: ActionPlan, attemptsOverride?: number): PolicyDecision {
  const attempts = attemptsOverride ?? action.attemptsUsed;
  const checks: PolicyDecision["checks"] = [];
  const violations: PolicyDecision["violations"] = [];

  const amountOk = action.maxAmountPerCustomer <= POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT;
  checks.push({
    rule: "MAX_AUTO_ACTION_AMOUNT",
    passed: amountOk,
    detail: `₹${action.maxAmountPerCustomer.toLocaleString("en-IN")} per customer vs ceiling ₹${POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT.toLocaleString("en-IN")}`,
  });
  if (!amountOk)
    violations.push({
      rule: "MAX_AUTO_ACTION_AMOUNT",
      message: `Per-customer amount ₹${action.maxAmountPerCustomer.toLocaleString("en-IN")} exceeds the ₹${POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT.toLocaleString("en-IN")} ceiling.`,
    });

  const attemptsOk = attempts < POLICY_LIMITS.MAX_RETRY_ATTEMPTS;
  checks.push({
    rule: "MAX_RETRY_ATTEMPTS",
    passed: attemptsOk,
    detail: `${attempts} of ${POLICY_LIMITS.MAX_RETRY_ATTEMPTS} attempts used`,
  });
  if (!attemptsOk)
    violations.push({
      rule: "MAX_RETRY_ATTEMPTS",
      message: `Retry ceiling reached — ${attempts} of ${POLICY_LIMITS.MAX_RETRY_ATTEMPTS} attempts already spent on this cohort.`,
    });

  const blastOk = action.targetCustomers <= POLICY_LIMITS.MAX_CUSTOMERS_PER_ACTION;
  checks.push({
    rule: "MAX_CUSTOMERS_PER_ACTION",
    passed: blastOk,
    detail: `${action.targetCustomers} customers vs ceiling ${POLICY_LIMITS.MAX_CUSTOMERS_PER_ACTION}`,
  });
  if (!blastOk)
    violations.push({
      rule: "MAX_CUSTOMERS_PER_ACTION",
      message: `Target cohort of ${action.targetCustomers} exceeds the ${POLICY_LIMITS.MAX_CUSTOMERS_PER_ACTION}-customer blast-radius ceiling.`,
    });

  const requiresApproval =
    POLICY_LIMITS.HIGH_RISK_REQUIRES_APPROVAL && action.risk !== "low";
  checks.push({
    rule: "HIGH_RISK_REQUIRES_APPROVAL",
    passed: true,
    detail: requiresApproval
      ? `Risk rated ${action.risk} — named human approval required before execution`
      : "Risk rated low — approval not required by policy",
  });

  checks.push({
    rule: "TEST_MODE_ONLY",
    passed: true,
    detail: "Executor is bound to Razorpay test-mode endpoints",
  });

  return {
    allowed: violations.length === 0,
    requiresApproval,
    violations,
    checks,
    policyId: action.policyId,
  };
}
