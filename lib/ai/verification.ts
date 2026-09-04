import { POLICY_LIMITS } from "@/lib/policies/policyEngine";
import { formatINR } from "@/lib/utils";
import type { ActionPlan, Transaction, VerificationReport } from "@/lib/types";

/**
 * Verification — stage 9 of the loop.
 *
 * An action is not "done" because the gateway returned 200. Verification
 * re-reads the outcome against the ledger and against the guardrails the action
 * was approved under, and reports what it actually found. A partial or failed
 * verdict is a legitimate outcome and is written to the audit trail as such.
 */
export function verifyExecution(input: {
  action: ActionPlan;
  attempted: Transaction[];
  succeeded: Transaction[];
  recoveredAmount: number;
  at: string;
}): VerificationReport {
  const { action, attempted, succeeded, recoveredAmount, at } = input;

  const uniqueCustomers = new Set(attempted.map((t) => t.customerId)).size;
  const maxAmount = attempted.reduce((m, t) => Math.max(m, t.amount), 0);
  const reconciled = succeeded.reduce((a, t) => a + t.amount, 0);

  const checks: VerificationReport["checks"] = [
    {
      label: "Recovered value reconciles to the succeeded payments",
      passed: reconciled === recoveredAmount,
      detail: `${formatINR(reconciled)} across ${succeeded.length} payments`,
    },
    {
      label: "Ledger delta stays inside the action's exposure",
      passed: recoveredAmount <= action.totalExposure,
      detail: `${formatINR(recoveredAmount)} of ${formatINR(action.totalExposure)} exposure`,
    },
    {
      label: "No customer was contacted more than once",
      passed: uniqueCustomers === attempted.length,
      detail: `${uniqueCustomers} unique customers across ${attempted.length} attempts`,
    },
    {
      label: "No payment exceeded the per-customer ceiling",
      passed: maxAmount <= POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT,
      detail: `largest attempt ${formatINR(maxAmount)} vs ceiling ${formatINR(POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT)}`,
    },
    {
      label: "Attempt ceiling respected",
      passed: action.attemptsUsed + 1 <= action.maxAttempts,
      detail: `${action.attemptsUsed + 1} of ${action.maxAttempts} attempts used`,
    },
  ];

  const failedChecks = checks.filter((c) => !c.passed).length;
  return {
    checkedAt: at,
    checks,
    ledgerDelta: recoveredAmount,
    verdict: failedChecks === 0 ? "verified" : failedChecks < 2 ? "partial" : "not_verified",
  };
}
