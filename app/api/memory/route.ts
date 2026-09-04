import { NextResponse } from "next/server";
import { getMerchantMemory } from "@/lib/ai/merchantMemory";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ memory: getMerchantMemory() });
}
