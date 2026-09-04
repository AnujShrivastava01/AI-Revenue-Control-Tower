import { NextResponse } from "next/server";
import { getAction } from "@/lib/ai/decisionEngine";
import { getInvestigation } from "@/lib/ai/investigator";
import { evaluate, getPolicy } from "@/lib/policies/policyEngine";
import { heldForManualApproval, resolveCohort } from "@/lib/ai/actionExecutor";
import { getMode } from "@/lib/razorpay/client";
import { actionIdSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = actionIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action id." }, { status: 400 });
  }
  const action = getAction(parsed.data);
  if (!action) {
    return NextResponse.json({ error: "Action not found." }, { status: 404 });
  }
  const cohort = resolveCohort(action);
  const held = action.investigationId === "inv_1042" ? heldForManualApproval() : [];
  const investigation = getInvestigation(action.investigationId);

  return NextResponse.json({
    action,
    policy: evaluate(action),
    policyDocument: getPolicy(action.policyId),
    gateway: getMode(),
    cohortSize: cohort.length,
    cohortValue: cohort.reduce((a, t) => a + t.amount, 0),
    heldForManualApproval: {
      count: held.length,
      value: held.reduce((a, t) => a + t.amount, 0),
      samples: held.slice(0, 6).map((t) => ({ id: t.id, amount: t.amount })),
    },
    investigation: investigation
      ? {
          id: investigation.id,
          title: investigation.title,
          impact: investigation.impact,
          recoverable: investigation.recoverable,
          severity: investigation.severity,
          recommendation: investigation.recommendation,
        }
      : null,
    fallback: action.fallbackActionId ? getAction(action.fallbackActionId) ?? null : null,
  });
}
