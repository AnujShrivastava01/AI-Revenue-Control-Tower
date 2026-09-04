import { NextResponse } from "next/server";
import { runStage } from "@/lib/ai/actionExecutor";
import { actionIdSchema, executeRequestSchema } from "@/lib/validation/schemas";
import { getAction } from "@/lib/ai/decisionEngine";

export const dynamic = "force-dynamic";

/**
 * Executes one stage of an approved action.
 *
 * The body carries a stage name and nothing else. The cohort, the amounts, the
 * policy and the gateway target are all re-derived server-side from the stored
 * plan — a caller cannot widen the scope of an action by sending more fields.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const idCheck = actionIdSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json(
      { error: "Invalid action id.", detail: idCheck.error.issues[0]?.message },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = executeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Unrecognised execution stage.", detail: parsed.error.issues[0]?.message },
      { status: 422 },
    );
  }

  const action = getAction(idCheck.data);
  if (!action) {
    return NextResponse.json({ error: "Action not found." }, { status: 404 });
  }
  if (action.status === "completed" || action.status === "rejected") {
    return NextResponse.json(
      { error: `Action is already ${action.status.replace("_", " ")}.` },
      { status: 409 },
    );
  }

  try {
    const outcome = await runStage(idCheck.data, parsed.data.stage, parsed.data.constraints);
    return NextResponse.json(outcome);
  } catch (err) {
    // Never surface a stack trace; give the operator something actionable.
    return NextResponse.json(
      {
        error: "The executor could not complete this stage.",
        detail:
          err instanceof Error && err.message.includes("RAZORPAY_KEY_ID")
            ? err.message
            : "An unexpected condition was reached while executing. Nothing was dispatched.",
      },
      { status: 500 },
    );
  }
}
