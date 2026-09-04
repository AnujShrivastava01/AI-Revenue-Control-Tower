"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Loader2, ShieldCheck, X } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  KeyValue,
  Panel,
  PanelHeader,
  StatusDot,
} from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { useSession } from "@/components/state/session";
import { cn, dateTimeIST, formatINR, formatPercent, formatShortINR, timeISTSeconds } from "@/lib/utils";
import type {
  ActionPlan,
  ActionResult,
  ActionStatus,
  AuditEvent,
  Policy,
  PolicyDecision,
  VerificationReport,
} from "@/lib/types";
import type { RazorpayModeInfo } from "@/lib/razorpay/client";

const STAGES = ["prepare", "policy", "eligibility", "gateway", "verify"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  prepare: "Preparing action",
  policy: "Validating policy",
  eligibility: "Checking transaction eligibility",
  gateway: "Executing test-mode request",
  verify: "Verifying result",
};

interface StageOutcome {
  stage: Stage;
  label: string;
  ok: boolean;
  detail: string;
  at: string;
  facts: { label: string; value: string; mono?: boolean }[];
  events: AuditEvent[];
  next: Stage | null;
  status: ActionStatus;
  terminal: boolean;
  policy?: PolicyDecision;
  result?: ActionResult;
  verification?: VerificationReport;
  fallbackActionId?: string;
  failure?: { title: string; reason: string; policy: string; response: string };
}

export interface ActionWorkspaceData {
  action: ActionPlan;
  policy: PolicyDecision;
  policyDocument: Policy;
  gateway: RazorpayModeInfo;
  cohortSize: number;
  cohortValue: number;
  heldForManualApproval: { count: number; value: number; samples: { id: string; amount: number }[] };
  investigation: {
    id: string;
    title: string;
    impact: number;
    recoverable: number;
    severity: string;
  } | null;
  fallback: ActionPlan | null;
}

const RISK_TONE = { low: "ok", medium: "warn", high: "danger" } as const;
const STATUS_TONE: Record<ActionStatus, "neutral" | "ok" | "warn" | "danger" | "accent"> = {
  pending_approval: "warn",
  approved: "accent",
  executing: "accent",
  completed: "ok",
  failed: "danger",
  rejected: "neutral",
  blocked_by_policy: "danger",
};

export function ActionWorkspace({ data }: { data: ActionWorkspaceData }) {
  const { action, policy, policyDocument, gateway, investigation, fallback } = data;
  const router = useRouter();
  const { state, hydrated, setAction, appendEvents } = useSession();

  const session = state.actions[action.id];
  const status: ActionStatus = session?.status ?? action.status;

  const [steps, setSteps] = React.useState<StageOutcome[]>([]);
  const [running, setRunning] = React.useState<Stage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [constraints, setConstraints] = React.useState<{
    maxCustomers: number;
    maxAmountPerCustomer: number;
  }>({ maxCustomers: action.targetCustomers, maxAmountPerCustomer: action.maxAmountPerCustomer });

  const narrowed =
    constraints.maxCustomers < action.targetCustomers ||
    constraints.maxAmountPerCustomer < action.maxAmountPerCustomer;

  const terminalStep = steps.find((s) => s.terminal);
  const result = terminalStep?.result ?? session?.result;
  const verification =
    steps.find((s) => s.verification)?.verification ?? session?.verification;
  const failure = steps.find((s) => s.failure)?.failure;

  async function runFrom(stage: Stage) {
    setError(null);
    let current: Stage | null = stage;
    const collected: StageOutcome[] = [];

    while (current) {
      setRunning(current);
      const started = Date.now();
      let outcome: StageOutcome;
      try {
        const res = await fetch(`/api/actions/${action.id}/execute`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stage: current,
            constraints: narrowed
              ? {
                  maxCustomers: constraints.maxCustomers,
                  maxAmountPerCustomer: constraints.maxAmountPerCustomer,
                }
              : undefined,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string; detail?: string };
          throw new Error(body.detail ?? body.error ?? `Stage failed (${res.status})`);
        }
        outcome = (await res.json()) as StageOutcome;
      } catch (e) {
        setRunning(null);
        setError(
          e instanceof Error
            ? e.message
            : "The executor could not be reached. Nothing was dispatched.",
        );
        return;
      }

      // Hold each step briefly so the operator can read what happened.
      const elapsed = Date.now() - started;
      if (elapsed < 620) await new Promise((r) => setTimeout(r, 620 - elapsed));

      collected.push(outcome);
      setSteps([...collected]);
      appendEvents(outcome.events);

      if (outcome.terminal || !outcome.ok) {
        setRunning(null);
        setAction(action.id, {
          status: outcome.status,
          result: outcome.result ?? collected.find((s) => s.result)?.result,
          verification: outcome.verification,
          completedAt: outcome.at,
        });
        router.refresh();
        return;
      }
      current = outcome.next;
    }
    setRunning(null);
  }

  async function reject() {
    try {
      const res = await fetch(`/api/actions/${action.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || "No reason given" }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { events: AuditEvent[]; status: ActionStatus };
      appendEvents(body.events);
      setAction(action.id, { status: body.status });
      setRejectOpen(false);
      router.refresh();
    } catch {
      setError("Unable to record the rejection. Nothing was changed.");
    }
  }

  const isPending = status === "pending_approval" && steps.length === 0;
  const isRunning = running !== null;
  const showResult = steps.length > 0 || Boolean(session?.result) || status === "completed" || status === "failed";

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      {/* ---------------------------------------------------------- header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/actions" className="text-xxs uppercase tracking-wider text-ink-4 hover:text-ink">
          Actions
        </Link>
        <span className="text-ink-4">/</span>
        <span className="font-mono text-[11px] text-ink-3">{action.id}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">
            {action.kind === "payment_retry" ? "Retry action" : "Recovery action"}
          </p>
          <h1 className="max-w-[24ch] text-[26px] font-semibold leading-tight tracking-[-0.028em] text-ink">
            {action.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[status]}>{status.replace(/_/g, " ")}</Badge>
            <Badge tone={RISK_TONE[action.risk]}>{action.risk} risk</Badge>
            <Badge tone={gateway.mode === "test" ? "ok" : "warn"}>{gateway.label}</Badge>
            {investigation ? (
              <Link
                href={`/investigations/${investigation.id}`}
                className="font-mono text-[11px] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
              >
                {investigation.id}
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: "Expected recovery", value: formatShortINR(action.expectedRecovery), tone: "ok" },
            { label: "Success probability", value: formatPercent(action.successProbability, 0) },
            { label: "Target", value: `${action.targetCustomers} customers` },
            { label: "Exposure", value: formatShortINR(action.totalExposure) },
          ].map((s) => (
            <div key={s.label}>
              <dt className="eyebrow mb-1">{s.label}</dt>
              <dd
                className={cn(
                  "text-[19px] font-semibold leading-none tracking-[-0.02em] tnum",
                  s.tone === "ok" ? "text-ok" : "text-ink",
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* -------------------------------------------------- what it does */}
          <Panel>
            <PanelHeader title="What this action does" meta={`Created ${dateTimeIST(action.createdAt)}`} />
            <div className="space-y-4 px-4 py-4">
              <p className="text-[14px] leading-[1.6] text-ink-2">{action.description}</p>
              <div className="rounded-md border border-line bg-raised p-3">
                <KeyValue
                  columns={3}
                  items={[
                    { label: "Action", value: action.title },
                    { label: "Target", value: `${action.targetCustomers} customers` },
                    { label: "Maximum amount", value: `${formatINR(action.maxAmountPerCustomer)}/customer` },
                    { label: "Maximum attempts", value: `${action.maxAttempts} (${action.attemptsUsed} used)` },
                    { label: "Expected recovery", value: formatShortINR(action.expectedRecovery) },
                    { label: "Success probability", value: formatPercent(action.successProbability, 0) },
                    { label: "Risk", value: action.risk },
                    { label: "Policy", value: `${action.policyId} · ${policyDocument.version}`, mono: true },
                    { label: "Created by", value: "decision engine" },
                  ]}
                />
              </div>
            </div>
          </Panel>

          {/* --------------------------------------------------------- why */}
          <Panel>
            <PanelHeader title="Why this action?" />
            <div className="px-4 py-4">
              <p className="text-[14px] leading-[1.65] text-ink-2">{action.rationale}</p>
              {investigation ? (
                <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-3">
                  Derived from{" "}
                  <Link
                    href={`/investigations/${investigation.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {investigation.title}
                  </Link>{" "}
                  — {formatShortINR(investigation.impact)} at risk, {formatShortINR(investigation.recoverable)}{" "}
                  modelled recoverable.
                </p>
              ) : null}
            </div>
          </Panel>

          {/* ------------------------------------------------ execution log */}
          {showResult ? (
            <ExecutionLog
              steps={steps}
              running={running}
              result={result}
              verification={verification}
              failure={failure}
              fallback={fallback}
              action={action}
            />
          ) : null}

          {error ? (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4">
              <p className="text-[13.5px] font-medium text-danger">Execution could not start.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{error}</p>
              <Button className="mt-3" onClick={() => runFrom("prepare")}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>

        {/* --------------------------------------------------------- sidebar */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Safety policy"
              meta={`${policyDocument.id} · ${policyDocument.version}`}
              action={
                <span className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-3">
                  <ShieldCheck size={13} strokeWidth={1.9} />
                  Server-enforced
                </span>
              }
            />
            <ul className="divide-y divide-line">
              {policy.checks.map((c) => (
                <li key={c.rule} className="flex items-start gap-2.5 px-4 py-2.5">
                  {c.passed ? (
                    <Check size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ok" />
                  ) : (
                    <X size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-mono text-[11.5px] text-ink">{c.rule}</span>
                    <span className="block text-[12.5px] leading-relaxed text-ink-3">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-4 py-2.5">
              <p className="text-[12px] leading-relaxed text-ink-4">
                Policy is evaluated server-side on every stage. A request that tries to widen
                the cohort or raise a ceiling is clamped to the stored plan, not honoured.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Guardrails" />
            <dl className="divide-y divide-line">
              {action.guardrails.map((g) => (
                <div key={g.label} className="px-4 py-2.5">
                  <dt className="eyebrow mb-0.5">{g.label}</dt>
                  <dd className="text-[13px] text-ink-2">{g.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {data.heldForManualApproval.count > 0 ? (
            <Panel>
              <PanelHeader
                title="Held for manual approval"
                meta={`${data.heldForManualApproval.count} payments · ${formatShortINR(data.heldForManualApproval.value)}`}
              />
              <div className="px-4 py-3">
                <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink-3">
                  These failures exceed the {formatINR(action.maxAmountPerCustomer)} per-customer
                  ceiling, so no automated action may touch them. They route to a human queue.
                </p>
                <ul className="space-y-1">
                  {data.heldForManualApproval.samples.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[11.5px] text-ink-2">{s.id}</span>
                      <span className="text-[12.5px] text-ink tnum">{formatINR(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------------- action bar */}
      {hydrated && isPending && !isRunning ? (
        <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-1 py-3 backdrop-blur-sm lg:bottom-0">
          <Button variant="primary" size="lg" onClick={() => runFrom("prepare")}>
            Approve action
          </Button>
          <Button size="lg" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" size="lg" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
          {narrowed ? (
            <Badge tone="accent">
              Narrowed to {constraints.maxCustomers} customers ·{" "}
              {formatINR(constraints.maxAmountPerCustomer)} ceiling
            </Badge>
          ) : null}
          <span className="ml-auto text-[12.5px] text-ink-4">
            {action.requiresApproval
              ? "Approval is required by RECOVERY_V2 for any action above low risk."
              : "This action class does not require approval, but you are approving it explicitly."}
          </span>
        </div>
      ) : null}

      {hydrated && status === "rejected" ? (
        <div className="mt-4 rounded-md border border-line bg-raised p-4">
          <p className="text-[13.5px] font-medium text-ink">Action rejected</p>
          <p className="mt-1 text-[13px] text-ink-3">
            The rejection is recorded in the audit trail. Nothing was dispatched.
          </p>
          <ButtonLink href="/audit" className="mt-3">
            Open audit trail
            <ArrowRight size={13} strokeWidth={2} />
          </ButtonLink>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ edit */}
      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit action scope"
        subtitle="You can narrow this action. Widening it is not possible."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => setEditOpen(false)}>
              Apply
            </Button>
            <Button
              onClick={() => {
                setConstraints({
                  maxCustomers: action.targetCustomers,
                  maxAmountPerCustomer: action.maxAmountPerCustomer,
                });
                setEditOpen(false);
              }}
            >
              Reset to plan
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="cohort-size" className="eyebrow mb-2 block">
              Customers targeted
            </label>
            <input
              id="cohort-size"
              type="range"
              min={1}
              max={action.targetCustomers}
              value={constraints.maxCustomers}
              onChange={(e) =>
                setConstraints((c) => ({ ...c, maxCustomers: Number(e.target.value) }))
              }
              className="w-full accent-[#101216]"
            />
            <div className="mt-1 flex items-baseline justify-between text-[13px]">
              <span className="text-ink-3">1</span>
              <span className="font-semibold text-ink tnum">{constraints.maxCustomers}</span>
              <span className="text-ink-3 tnum">{action.targetCustomers}</span>
            </div>
          </div>

          <div>
            <label htmlFor="ceiling" className="eyebrow mb-2 block">
              Per-customer ceiling
            </label>
            <input
              id="ceiling"
              type="range"
              min={100}
              max={action.maxAmountPerCustomer}
              step={100}
              value={constraints.maxAmountPerCustomer}
              onChange={(e) =>
                setConstraints((c) => ({ ...c, maxAmountPerCustomer: Number(e.target.value) }))
              }
              className="w-full accent-[#101216]"
            />
            <div className="mt-1 flex items-baseline justify-between text-[13px]">
              <span className="text-ink-3">₹100</span>
              <span className="font-semibold text-ink tnum">
                {formatINR(constraints.maxAmountPerCustomer)}
              </span>
              <span className="text-ink-3 tnum">{formatINR(action.maxAmountPerCustomer)}</span>
            </div>
          </div>

          <p className="rounded-md border border-line bg-raised p-3 text-[12.5px] leading-relaxed text-ink-3">
            The executor re-derives the cohort and the expected value from the ledger at run
            time using whichever is stricter — this setting or the stored plan. Narrowing here
            can only reduce what the action touches.
          </p>
        </div>
      </Drawer>

      {/* ---------------------------------------------------------- reject */}
      <Drawer
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this action"
        subtitle="The rejection and its reason are written to the audit trail."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={reject}>
              Confirm rejection
            </Button>
            <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          </div>
        }
      >
        <label htmlFor="reject-reason" className="eyebrow mb-2 block">
          Reason
        </label>
        <textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="e.g. Customer-contact volume too high during the current campaign."
          className="w-full rounded-[4px] border border-line bg-raised p-3 text-[13px] text-ink placeholder:text-ink-4 focus:border-line-strong focus:bg-surface focus:outline-none"
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Rejected actions are not discarded. The decision engine keeps the case open and can
          propose a narrower alternative.
        </p>
      </Drawer>
    </div>
  );
}

/* ------------------------------------------------------------ execution */

function ExecutionLog({
  steps,
  running,
  result,
  verification,
  failure,
  fallback,
  action,
}: {
  steps: StageOutcome[];
  running: Stage | null;
  result?: ActionResult;
  verification?: VerificationReport;
  failure?: { title: string; reason: string; policy: string; response: string };
  fallback: ActionPlan | null;
  action: ActionPlan;
}) {
  const doneStages = new Set(steps.map((s) => s.stage));

  return (
    <>
      <Panel>
        <PanelHeader
          title="Execution"
          meta={running ? "Running" : steps.some((s) => !s.ok) ? "Halted" : "Complete"}
          action={
            running ? (
              <span className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-3">
                <Loader2 size={12} className="animate-spin" />
                {STAGE_LABEL[running]}
              </span>
            ) : null
          }
        />
        <ol className="divide-y divide-line">
          {STAGES.map((stage) => {
            const step = steps.find((s) => s.stage === stage);
            const isRunning = running === stage;
            const skipped = !step && !isRunning && steps.some((s) => s.terminal);
            return (
              <li
                key={stage}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  skipped && "opacity-40",
                  step && "animate-fade-up",
                )}
              >
                <span className="mt-[3px] shrink-0">
                  {isRunning ? (
                    <Loader2 size={14} className="animate-spin text-ink-3" />
                  ) : step?.ok ? (
                    <Check size={14} strokeWidth={2.2} className="text-ok" />
                  ) : step ? (
                    <AlertTriangle size={14} strokeWidth={2} className="text-danger" />
                  ) : (
                    <StatusDot className="ml-[3px] mt-[5px]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={cn(
                        "text-[13.5px]",
                        step || isRunning ? "font-medium text-ink" : "text-ink-3",
                      )}
                    >
                      {STAGE_LABEL[stage]}
                    </span>
                    {step ? (
                      <span className="shrink-0 font-mono text-[11px] text-ink-4 tnum">
                        {timeISTSeconds(step.at)}
                      </span>
                    ) : null}
                  </div>
                  {step ? (
                    <>
                      <p
                        className={cn(
                          "mt-1 text-[13px] leading-relaxed",
                          step.ok ? "text-ink-3" : "text-danger",
                        )}
                      >
                        {step.detail}
                      </p>
                      {step.facts.length ? (
                        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                          {step.facts.map((f, i) => (
                            <div
                              key={`${f.label}-${i}`}
                              className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1 last:border-b-0"
                            >
                              <dt className="truncate font-mono text-[11px] text-ink-4">
                                {f.label}
                              </dt>
                              <dd className="shrink-0 text-[12.5px] text-ink-2 tnum">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      {failure ? (
        <Panel className="border-danger/40">
          <div className="h-[2px] w-full bg-danger" aria-hidden />
          <div className="px-5 py-5">
            <h2 className="text-[20px] font-semibold uppercase tracking-[-0.01em] text-ink">
              {failure.title}
            </h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="eyebrow mb-1">Reason</dt>
                <dd className="text-[14px] text-ink-2">{failure.reason}</dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">Policy</dt>
                <dd className="text-[14px] text-ink-2">{failure.policy}</dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">AI response</dt>
                <dd className="max-w-[70ch] text-[14px] leading-[1.6] text-ink-2">
                  “{failure.response}”
                </dd>
              </div>
            </dl>
            {fallback ? (
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <ButtonLink href={`/actions/${fallback.id}`} variant="primary" size="lg">
                  Review alternative
                  <ArrowRight size={15} strokeWidth={2} />
                </ButtonLink>
                <span className="text-[13px] text-ink-3">
                  {fallback.title} · {formatShortINR(fallback.expectedRecovery)} expected recovery
                  at {formatPercent(fallback.successProbability, 0)}
                </span>
              </div>
            ) : null}
            <p className="mt-4 text-[12px] text-ink-4">
              This failure is written to the audit trail with its gateway response and the policy
              rule that halted it.
            </p>
          </div>
        </Panel>
      ) : null}

      {result?.ok && doneStages.has("verify") ? (
        <Panel>
          <div className="h-[2px] w-full bg-ok" aria-hidden />
          <div className="px-5 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="eyebrow mb-1.5">Recovered</p>
                <p className="text-[30px] font-semibold leading-none tracking-[-0.03em] text-ok tnum">
                  {formatINR(result.recoveredAmount)}
                </p>
                <p className="mt-2 text-[13px] text-ink-3 tnum">
                  {result.succeeded} of {result.attempted} converted · modelled{" "}
                  {formatINR(action.expectedRecovery)}
                </p>
              </div>
              <div className="text-right">
                <p className="eyebrow mb-1.5">Gateway</p>
                <p className="font-mono text-[12px] text-ink-2">{result.gateway}</p>
                {result.gatewayReference ? (
                  <p className="mt-1 font-mono text-[11px] text-ink-4">{result.gatewayReference}</p>
                ) : null}
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-3">
              {result.message}
            </p>
          </div>
        </Panel>
      ) : null}

      {verification ? (
        <Panel>
          <PanelHeader
            title="Verification"
            meta={`Verdict: ${verification.verdict}`}
            action={
              <Badge tone={verification.verdict === "verified" ? "ok" : "warn"}>
                {verification.verdict}
              </Badge>
            }
          />
          <ul className="divide-y divide-line">
            {verification.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 px-4 py-2.5">
                {c.passed ? (
                  <Check size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ok" />
                ) : (
                  <X size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger" />
                )}
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink">{c.label}</span>
                  <span className="block text-[12.5px] text-ink-3 tnum">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
            <ButtonLink href="/audit">
              Open audit trail
              <ArrowRight size={13} strokeWidth={2} />
            </ButtonLink>
            <span className="text-[12.5px] text-ink-4">
              Every stage above is recorded with its actor, result and reference.
            </span>
          </div>
        </Panel>
      ) : null}
    </>
  );
}
