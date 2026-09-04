import { NextResponse } from "next/server";
import { getMode, ping } from "@/lib/razorpay/client";

export const dynamic = "force-dynamic";

/**
 * Reports gateway mode and, when credentials are configured, verifies them with
 * a read-only call. Never returns the key or the secret.
 */
export async function GET() {
  const mode = getMode();
  const check = await ping();
  return NextResponse.json({ mode, check });
}
