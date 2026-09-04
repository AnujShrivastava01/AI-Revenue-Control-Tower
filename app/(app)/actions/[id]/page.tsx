import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionWorkspace, type ActionWorkspaceData } from "@/components/actions/action-workspace";
import { getAction } from "@/lib/ai/decisionEngine";
import { getInvestigation } from "@/lib/ai/investigator";
import { evaluate, getPolicy } from "@/lib/policies/policyEngine";
import { heldForManualApproval, resolveCohort } from "@/lib/ai/actionExecutor";
import { getMode } from "@/lib/razorpay/client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const action = getAction(id);
  return { title: action ? action.title : "Action" };
}

export default async function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const action = getAction(id);
  if (!action) notFound();

  const cohort = resolveCohort(action);
  const held = action.investigationId === "inv_1042" ? heldForManualApproval() : [];
  const investigation = getInvestigation(action.investigationId);

  const data: ActionWorkspaceData = {
    action,
    policy: evaluate(action),
    policyDocument: getPolicy(action.policyId),
    gateway: getMode(),
    cohortSize: cohort.length,
    cohortValue: cohort.reduce((a, t) => a + t.amount, 0),
    heldForManualApproval: {
      count: held.length,
      value: held.reduce((a, t) => a + t.amount, 0),
      samples: held
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6)
        .map((t) => ({ id: t.id, amount: t.amount })),
    },
    investigation: investigation
      ? {
          id: investigation.id,
          title: investigation.title,
          impact: investigation.impact,
          recoverable: investigation.recoverable,
          severity: investigation.severity,
        }
      : null,
    fallback: action.fallbackActionId ? (getAction(action.fallbackActionId) ?? null) : null,
  };

  return <ActionWorkspace data={data} />;
}
