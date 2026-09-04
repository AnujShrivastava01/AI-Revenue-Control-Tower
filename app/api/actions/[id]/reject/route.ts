import { NextResponse } from "next/server";
import { rejectAction } from "@/lib/ai/actionExecutor";
import { actionIdSchema, rejectRequestSchema } from "@/lib/validation/schemas";
import { getAction } from "@/lib/ai/decisionEngine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const idCheck = actionIdSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Invalid action id." }, { status: 400 });
  }
  if (!getAction(idCheck.data)) {
    return NextResponse.json({ error: "Action not found." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = rejectRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Rejection reason is not valid." }, { status: 422 });
  }

  return NextResponse.json(rejectAction(idCheck.data, parsed.data.reason));
}
