import { NextResponse } from "next/server";
import { getInvestigation } from "@/lib/ai/investigator";
import { narrateInvestigation } from "@/lib/ai/llm";
import { investigationIdSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = investigationIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid investigation id." }, { status: 400 });
  }
  const investigation = getInvestigation(parsed.data);
  if (!investigation) {
    return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
  }
  const narration = await narrateInvestigation(investigation);
  return NextResponse.json({ investigation, narration });
}
