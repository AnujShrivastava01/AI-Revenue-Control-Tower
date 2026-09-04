import { NextResponse } from "next/server";
import { getOpportunities } from "@/lib/analytics/opportunities";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ opportunities: getOpportunities() });
}
