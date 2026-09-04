import { NextResponse } from "next/server";
import { getBaseAuditEvents } from "@/lib/audit/events";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ events: getBaseAuditEvents() });
}
