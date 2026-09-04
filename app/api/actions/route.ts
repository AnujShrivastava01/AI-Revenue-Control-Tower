import { NextResponse } from "next/server";
import { getActions } from "@/lib/ai/decisionEngine";
import { evaluate } from "@/lib/policies/policyEngine";

export const dynamic = "force-dynamic";

export function GET() {
  const actions = getActions();
  return NextResponse.json({
    actions: actions.map((a) => ({ ...a, policy: evaluate(a) })),
  });
}
