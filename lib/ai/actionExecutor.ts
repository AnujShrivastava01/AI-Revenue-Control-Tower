import "server-only";
import * as C from "@/lib/demo/config";
import { getDataset } from "@/lib/demo/dataset";
import { getAction } from "./decisionEngine";
import { evaluate, POLICY_LIMITS } from "@/lib/policies/policyEngine";
import { createRecoveryOrder, fetchOrderPayments, getMode } from "@/lib/razorpay/client";
import { verifyExecution } from "./verification";
import { formatINR, formatShortINR } from "@/lib/utils";
import type { ExecutionConstraints } from "@/lib/validation/schemas";
import type {
  ActionPlan,
  ActionResult,
  ActionStatus,
  AuditEvent,
  PolicyDecision,
  Transaction,
  VerificationReport,
} from "@/lib/types";

/**
 * Action executor — stage 8 of the loop, and the only place in the codebase
 * that is allowed to talk to a payment gateway.
 *
 * The executor takes an *action id*, not an instruction. It re-derives the plan
 * server-side, re-runs the policy engine, and refuses anything that does not
 * clear it. A model's output can reach this module only as an id that already
 * corresponds to a stored, policy-checked plan.
 */

export const STAGES = ["prepare", "policy", "eligibility", "gateway", "verify"] as const;
export type ExecutionStage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<ExecutionStage, string> = {
  prepare: "Preparing action",
  policy: "Validating policy",
  eligibility: "Checking transaction eligibility",
  gateway: "Executing test-mode request",
  verify: "Verifying result",
};

export interface StageOutcome {
  stage: ExecutionStage;
  label: string;
  ok: boolean;
  detail: string;
  at: string;
  facts: { label: string; value: string; mono?: boolean }[];
  events: AuditEvent[];
  next: ExecutionStage | null;
  status: ActionStatus;
  terminal: boolean;
  policy?: PolicyDecision;
  result?: ActionResult;
  verification?: VerificationReport;
  fallbackActionId?: string;
  failure?: { title: string; reason: string; policy: string; response: string };
}

const BASE = Date.parse(C.DEMO_NOW) + 30_000;
const STAGE_OFFSET: Record<ExecutionStage, number> = {
  prepare: 0,
  policy: 3_000,
  eligibility: 6_000,
  gateway: 11_000,
  verify: 27_000,
};

/**
 * Execution clock. The demo clock is fixed, so each action is given its own
 * minute-wide slot; two runs in the same session then read as consecutive in
 * the audit trail rather than colliding on identical timestamps.
 */
function clockFor(actionId: string) {
  const slot = (Number(actionId.replace(/\D/g, "")) % 30) * 90_000;
  return (stage: ExecutionStage, extra = 0): string =>
    new Date(BASE + slot + STAGE_OFFSET[stage] + extra).toISOString();
}

let auditCounter = 0;
function audit(e: Omit<AuditEvent, "id">): AuditEvent {
  auditCounter += 1;
  return { id: `aud_x${auditCounter}_${e.refId}_${e.event.slice(0, 8).replace(/\W/g, "")}`, ...e };
}

/** Deterministic per-transaction draw — same input, same outcome, always. */
function draw(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** The cohort an action operates on, re-derived from the ledger. */
export function resolveCohort(
  action: ActionPlan,
  constraints?: ExecutionConstraints,
): Transaction[] {
  const ds = getDataset();
  let cohort: Transaction[] = [];
  if (action.kind === "payment_retry" || action.kind === "alternate_method_offer") {
    if (action.investigationId === "inv_1042") cohort = ds.highIntent;
  }
  if (!cohort.length) return cohort;

  // Operator constraints may only narrow. Taking the minimum against the stored
  // plan means an oversized request tightens the action instead of widening it.
  const ceiling = Math.min(
    action.maxAmountPerCustomer,
    constraints?.maxAmountPerCustomer ?? action.maxAmountPerCustomer,
  );
  const size = Math.min(
    action.targetCustomers,
    constraints?.maxCustomers ?? action.targetCustomers,
  );
  return cohort.filter((t) => t.amount <= ceiling).slice(0, size);
}

/** The per-customer ceiling actually in force for a run. */
export function effectiveCeiling(
  action: ActionPlan,
  constraints?: ExecutionConstraints,
): number {
  return Math.min(
    POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT,
    action.maxAmountPerCustomer,
    constraints?.maxAmountPerCustomer ?? action.maxAmountPerCustomer,
  );
}

/** Incident failures the per-customer ceiling holds back from automation. */
export function heldForManualApproval(): Transaction[] {
  return getDataset().incident.filter((t) => t.amount > POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT);
}

export async function runStage(
  actionId: string,
  stage: ExecutionStage,
  constraints?: ExecutionConstraints,
): Promise<StageOutcome> {
  const at = clockFor(actionId);
  const action = getAction(actionId);
  if (!action) {
    return {
      stage,
      label: STAGE_LABELS[stage],
      ok: false,
      detail: "Unknown action.",
      at: at(stage),
      facts: [],
      events: [],
      next: null,
      status: "failed",
      terminal: true,
    };
  }

  const cohort = resolveCohort(action, constraints);
  const ceiling = effectiveCeiling(action, constraints);
  const narrowed =
    cohort.length > 0 &&
    (cohort.length < action.targetCustomers || ceiling < action.maxAmountPerCustomer);
  const mode = getMode();

  switch (stage) {
    case "prepare": {
      const size = cohort.length || action.targetCustomers;
      const exposure = cohort.length
        ? cohort.reduce((a, t) => a + t.amount, 0)
        : action.totalExposure;
      return {
        stage,
        label: STAGE_LABELS.prepare,
        ok: true,
        detail: `Cohort resolved from the transaction ledger: ${size.toLocaleString("en-IN")} target${size === 1 ? "" : "s"}, ${formatShortINR(exposure)} exposure.`,
        at: at("prepare"),
        facts: [
          { label: "Targets", value: size.toLocaleString("en-IN"), mono: true },
          { label: "Exposure", value: formatINR(exposure) },
          { label: "Policy", value: action.policyId, mono: true },
          { label: "Gateway mode", value: mode.label },
          ...(narrowed
            ? [
                {
                  label: "Operator constraint",
                  value: `Narrowed to ${size} customers at ${formatINR(ceiling)} ceiling`,
                },
              ]
            : []),
        ],
        events: [
          audit({
            at: at("prepare"),
            actor: "merchant",
            event: "Action approved",
            detail: `${action.title} approved for ${size.toLocaleString("en-IN")} target${size === 1 ? "" : "s"} under ${action.policyId}`,
            refType: "action",
            refId: action.id,
            result: "ok",
          }),
          audit({
            at: at("prepare", 400),
            actor: "system",
            event: "Cohort resolved",
            detail: `${size.toLocaleString("en-IN")} targets, ${formatINR(exposure)} exposure, re-derived server-side`,
            refType: "action",
            refId: action.id,
            result: "info",
          }),
        ],
        next: "policy",
        status: "executing",
        terminal: false,
      };
    }

    case "policy": {
      const decision = evaluate(action);
      return {
        stage,
        label: STAGE_LABELS.policy,
        ok: decision.allowed,
        detail: decision.allowed
          ? `${decision.checks.filter((c) => c.passed).length} of ${decision.checks.length} rules passed under ${action.policyId}.`
          : decision.violations.map((v) => v.message).join(" "),
        at: at("policy"),
        facts: decision.checks.map((c) => ({ label: c.rule, value: c.detail })),
        events: [
          audit({
            at: at("policy"),
            actor: "policy",
            event: decision.allowed ? "Policy validation passed" : "Policy validation blocked action",
            detail: decision.allowed
              ? `${action.policyId} — all rules satisfied`
              : decision.violations.map((v) => v.message).join(" "),
            refType: "policy",
            refId: action.policyId,
            result: decision.allowed ? "ok" : "blocked",
          }),
        ],
        next: decision.allowed ? "eligibility" : null,
        status: decision.allowed ? "executing" : "blocked_by_policy",
        terminal: !decision.allowed,
        policy: decision,
      };
    }

    case "eligibility": {
      const held = action.investigationId === "inv_1042" ? heldForManualApproval() : [];
      const eligible = cohort.filter((t) => t.amount <= ceiling);
      const excluded = cohort.length - eligible.length;
      const heldValue = held.reduce((a, t) => a + t.amount, 0);
      const size = cohort.length ? eligible.length : action.targetCustomers;
      return {
        stage,
        label: STAGE_LABELS.eligibility,
        ok: true,
        detail: cohort.length
          ? `${eligible.length} of ${cohort.length} payments eligible. ${held.length} larger failures worth ${formatShortINR(heldValue)} stay outside automation — they exceed the ${formatINR(POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT)} per-customer ceiling and route to manual approval.`
          : `${size} target${size === 1 ? "" : "s"} eligible. No money movement in this action class.`,
        at: at("eligibility"),
        facts: cohort.length
          ? [
              { label: "Eligible", value: String(eligible.length), mono: true },
              { label: "Excluded by ceiling", value: String(excluded), mono: true },
              { label: "Held for manual approval", value: `${held.length} · ${formatINR(heldValue)}` },
              { label: "Largest eligible", value: formatINR(Math.max(...eligible.map((t) => t.amount), 0)) },
            ]
          : [{ label: "Targets", value: String(size), mono: true }],
        events: [
          audit({
            at: at("eligibility"),
            actor: "system",
            event: "Transaction eligibility checked",
            detail: cohort.length
              ? `${eligible.length} eligible · ${held.length} held for manual approval above the ₹${POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT.toLocaleString("en-IN")} ceiling`
              : `${size} targets eligible`,
            refType: "action",
            refId: action.id,
            result: "ok",
          }),
        ],
        next: "gateway",
        status: "executing",
        terminal: false,
      };
    }

    case "gateway": {
      // Non-payment actions do not touch the gateway at all; saying otherwise
      // would be a lie about what the system did.
      if (
        action.kind === "refund_hold" ||
        action.kind === "settlement_reconcile" ||
        action.kind === "duplicate_refund" ||
        action.kind === "fraud_block"
      ) {
        const CODE: Record<string, string> = {
          refund_hold: "REFUND_HOLD_APPLIED",
          settlement_reconcile: "RECONCILIATION_FILED",
          duplicate_refund: "DUPLICATE_REFUNDS_QUEUED",
          fraud_block: "PROFILES_BLOCKED",
        };
        const MESSAGE: Record<string, string> = {
          refund_hold: "Refund auto-approval paused for the targeted SKU. No gateway call was required.",
          settlement_reconcile:
            "Reconciliation request filed with the transaction-level match attached. No gateway call was required.",
          duplicate_refund: `Refund queued for all ${action.targetCustomers} duplicate captures, matched exactly to the original amount. No gateway call was required for this action class.`,
          fraud_block: `${action.targetCustomers} flagged profiles blocked and step-up verification enabled for new-profile card attempts. No gateway call was required.`,
        };
        const result: ActionResult = {
          actionId: action.id,
          ok: true,
          at: at("gateway"),
          code: CODE[action.kind],
          message: MESSAGE[action.kind],
          recoveredAmount: 0,
          attempted: action.targetCustomers,
          succeeded: action.targetCustomers,
          failed: 0,
          gateway: "razorpay_mock_adapter",
        };
        return {
          stage,
          label: STAGE_LABELS.gateway,
          ok: true,
          detail: result.message,
          at: result.at,
          facts: [{ label: "Gateway", value: "Not required for this action class" }],
          events: [
            audit({
              at: result.at,
              actor: "system",
              event: "Configuration change applied",
              detail: result.message,
              refType: "action",
              refId: action.id,
              result: "ok",
            }),
          ],
          next: "verify",
          status: "executing",
          terminal: false,
          result,
        };
      }

      if (action.kind === "alternate_method_offer" && action.investigationId !== "inv_1042") {
        const result: ActionResult = {
          actionId: action.id,
          ok: true,
          at: at("gateway"),
          code: "CHECKOUT_CONFIG_APPLIED",
          message: "Method ordering updated for the targeted segment. No money moved and no gateway call was required.",
          recoveredAmount: 0,
          attempted: action.targetCustomers,
          succeeded: action.targetCustomers,
          failed: 0,
          gateway: "razorpay_mock_adapter",
        };
        return {
          stage,
          label: STAGE_LABELS.gateway,
          ok: true,
          detail: result.message,
          at: result.at,
          facts: [{ label: "Gateway", value: "Not required for this action class" }],
          events: [
            audit({
              at: result.at,
              actor: "system",
              event: "Checkout configuration applied",
              detail: result.message,
              refType: "action",
              refId: action.id,
              result: "ok",
            }),
          ],
          next: "verify",
          status: "executing",
          terminal: false,
          result,
        };
      }

      const eligible = cohort.filter((t) => t.amount <= ceiling);
      const call = await createRecoveryOrder({
        amount: Math.min(
          POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT,
          Math.round(eligible.reduce((a, t) => a + t.amount, 0) / Math.max(1, eligible.length)),
        ),
        receipt: `${action.id}-${action.investigationId}`,
        notes: {
          action_id: action.id,
          investigation_id: action.investigationId,
          policy: action.policyId,
          environment: "financial-control-tower-demo",
        },
      });

      const gatewayEvents: AuditEvent[] = [
        audit({
          at: at("gateway"),
          actor: "api",
          event: mode.mode === "test" ? "Razorpay test API called" : "Local gateway adapter called",
          detail: `${call.endpoint} → ${call.code}${call.reference ? ` · ${call.reference}` : ""}`,
          refType: "action",
          refId: action.id,
          result: call.ok ? "ok" : "failed",
        }),
      ];

      // ---- the deterministic failure path -----------------------------------
      if (action.demoOutcome === "temporary_failure") {
        const followUp = call.reference
          ? await fetchOrderPayments(call.reference)
          : { ...call, code: "NO_ORDER_REFERENCE", message: "No order reference returned." };
        gatewayEvents.push(
          audit({
            at: at("gateway", 900),
            actor: "api",
            event: "Payment retry failed",
            detail: `${followUp.code} — ${followUp.message}`,
            refType: "action",
            refId: action.id,
            result: "failed",
          }),
        );

        const reEvaluated = evaluate(action, action.attemptsUsed + 1);
        gatewayEvents.push(
          audit({
            at: at("gateway", 1400),
            actor: "policy",
            event: "Fallback policy activated",
            detail: reEvaluated.violations[0]?.message ?? "Retry ceiling reached; further retries halted.",
            refType: "policy",
            refId: action.policyId,
            result: "blocked",
          }),
        );

        const result: ActionResult = {
          actionId: action.id,
          ok: false,
          at: at("gateway", 900),
          code: "TEMPORARY_PAYMENT_FAILURE",
          message: followUp.message,
          recoveredAmount: 0,
          attempted: eligible.length,
          succeeded: 0,
          failed: eligible.length,
          gateway: mode.mode === "test" ? "razorpay_test_api" : "razorpay_mock_adapter",
          gatewayReference: call.reference,
          fallbackActionId: action.fallbackActionId,
        };

        return {
          stage,
          label: STAGE_LABELS.gateway,
          ok: false,
          detail: followUp.message,
          at: result.at,
          facts: [
            { label: "Endpoint", value: call.endpoint, mono: true },
            { label: "Response", value: followUp.code, mono: true },
            { label: "Attempts used", value: `${action.attemptsUsed + 1} of ${action.maxAttempts}` },
            { label: "Policy", value: "MAX_RETRY_ATTEMPTS reached", mono: true },
          ],
          events: gatewayEvents,
          next: null,
          status: "failed",
          terminal: true,
          result,
          fallbackActionId: action.fallbackActionId,
          failure: {
            title: "Action could not be completed",
            reason: "Temporary payment failure.",
            policy: reEvaluated.violations[0]?.message ?? "Maximum retry threshold reached.",
            response:
              "I will not repeatedly retry this payment. The configured policy limit has been reached, and a further attempt against the same degraded rail would add cost without adding expected recovery. An alternate recovery workflow is available.",
          },
        };
      }

      // ---- the success path --------------------------------------------------
      const uplift = C.ALTERNATE_METHOD_UPLIFT;
      const succeeded = eligible.filter(
        (t) => draw(`${action.id}:${t.id}`) < Math.min(0.97, (t.recoveryProbability ?? 0) * uplift),
      );
      const recovered = succeeded.reduce((a, t) => a + t.amount, 0);
      const result: ActionResult = {
        actionId: action.id,
        ok: true,
        at: at("gateway", 900),
        code: "RECOVERY_COMPLETED",
        message:
          mode.mode === "test"
            ? `Test-mode recovery orders created for ${eligible.length} customers. Recovery value is modelled from this merchant's own conversion history — no live money moved.`
            : `Simulated by the local adapter for ${eligible.length} customers. No external request was made.`,
        recoveredAmount: recovered,
        attempted: eligible.length,
        succeeded: succeeded.length,
        failed: eligible.length - succeeded.length,
        gateway: mode.mode === "test" ? "razorpay_test_api" : "razorpay_mock_adapter",
        gatewayReference: call.reference,
      };
      gatewayEvents.push(
        audit({
          at: result.at,
          actor: "api",
          event: "Recovery offers dispatched",
          detail: `${succeeded.length} of ${eligible.length} converted · ${formatINR(recovered)} recovered`,
          refType: "action",
          refId: action.id,
          result: "ok",
        }),
      );

      return {
        stage,
        label: STAGE_LABELS.gateway,
        ok: true,
        detail: result.message,
        at: result.at,
        facts: [
          { label: "Endpoint", value: call.endpoint, mono: true },
          { label: "Response", value: call.code, mono: true },
          { label: "Reference", value: call.reference ?? "—", mono: true },
          { label: "Converted", value: `${succeeded.length} of ${eligible.length}` },
        ],
        events: gatewayEvents,
        next: "verify",
        status: "executing",
        terminal: false,
        result,
      };
    }

    case "verify": {
      const eligible = cohort.filter((t) => t.amount <= ceiling);
      const uplift = C.ALTERNATE_METHOD_UPLIFT;
      const succeeded = eligible.filter(
        (t) => draw(`${action.id}:${t.id}`) < Math.min(0.97, (t.recoveryProbability ?? 0) * uplift),
      );
      const recovered = succeeded.reduce((a, t) => a + t.amount, 0);

      const report = eligible.length
        ? verifyExecution({
            action,
            attempted: eligible,
            succeeded,
            recoveredAmount: recovered,
            at: at("verify"),
          })
        : {
            checkedAt: at("verify"),
            checks: [
              { label: "No money movement in this action class", passed: true, detail: "Configuration change only" },
              { label: "Change is reversible", passed: true, detail: "One-click revert available" },
              { label: "Scope matches the approved plan", passed: true, detail: `${action.targetCustomers} targets` },
            ],
            ledgerDelta: 0,
            verdict: "verified" as const,
          };

      return {
        stage,
        label: STAGE_LABELS.verify,
        ok: report.verdict === "verified",
        detail:
          report.verdict === "verified"
            ? eligible.length
              ? `Verified against the ledger: ${formatINR(recovered)} recovered across ${succeeded.length} payments, modelled ${formatINR(action.expectedRecovery)}.`
              : "Verified: the change is in effect, reversible, and matches the approved scope."
            : "Verification did not fully pass. The result is recorded as partial.",
        at: report.checkedAt,
        facts: report.checks.map((c) => ({ label: c.label, value: c.detail })),
        events: [
          audit({
            at: report.checkedAt,
            actor: "ai",
            event: "Result verified",
            detail: eligible.length
              ? `${formatINR(recovered)} recovered against ${formatINR(action.expectedRecovery)} modelled · ${report.verdict}`
              : `Configuration change verified · ${report.verdict}`,
            refType: "action",
            refId: action.id,
            result: report.verdict === "verified" ? "ok" : "failed",
          }),
        ],
        next: null,
        status: "completed",
        terminal: true,
        verification: report,
      };
    }
  }
}

/** Rejection is an outcome too, and it is recorded. */
export function rejectAction(actionId: string, reason: string): { events: AuditEvent[]; status: ActionStatus } {
  const at = clockFor(actionId);
  const action = getAction(actionId);
  return {
    status: "rejected",
    events: [
      audit({
        at: at("prepare"),
        actor: "merchant",
        event: "Action rejected",
        detail: `${action?.title ?? actionId} rejected by the merchant — ${reason}`,
        refType: "action",
        refId: actionId,
        result: "blocked",
      }),
    ],
  };
}
