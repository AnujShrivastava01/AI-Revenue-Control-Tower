import type { Metadata } from "next";
import { ActionsList } from "@/components/actions/actions-list";
import { getActions } from "@/lib/ai/decisionEngine";
import { getOverviewMetrics } from "@/lib/analytics/metrics";
import { POLICY_LIMITS } from "@/lib/policies/policyEngine";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Actions" };
export const dynamic = "force-dynamic";

export default function ActionsPage() {
  const actions = getActions();
  const m = getOverviewMetrics();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">Actions</h1>
          <p className="mt-1.5 max-w-[74ch] text-[13px] leading-relaxed text-ink-3">
            Every action is a bounded plan — a named cohort, a per-customer ceiling of{" "}
            {formatINR(POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT)}, an attempt ceiling and a policy.
            The decision engine proposes; the policy engine gates; a human approves; the
            executor is the only component that may call a gateway.
          </p>
        </div>
        <dl className="flex flex-wrap gap-8">
          <div>
            <dt className="eyebrow mb-1">Executed to date</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">{m.actionsExecuted}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Blocked by policy</dt>
            <dd className="text-[19px] font-semibold text-danger tnum">{m.actionsBlocked}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Human approvals</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">{m.humanApprovals}</dd>
          </div>
        </dl>
      </div>

      <ActionsList actions={actions} />
    </div>
  );
}
