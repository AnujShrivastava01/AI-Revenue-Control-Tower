import { NextResponse } from "next/server";
import { listInvestigations } from "@/lib/ai/investigator";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    investigations: listInvestigations().map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      severity: i.severity,
      impact: i.impact,
      recoverable: i.recoverable,
      confidence: i.confidence,
      openedAt: i.openedAt,
      affectedCount: i.affectedCount,
      summary: i.summary,
      rootCause: i.rootCause.statement,
    })),
  });
}
