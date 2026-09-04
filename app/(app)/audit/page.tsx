import type { Metadata } from "next";
import { AuditStream } from "@/components/audit/audit-stream";
import { getBaseAuditEvents } from "@/lib/audit/events";

export const metadata: Metadata = { title: "Audit Trail" };
export const dynamic = "force-dynamic";

export default function AuditPage() {
  const events = getBaseAuditEvents();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">Audit trail</h1>
        <p className="mt-1.5 max-w-[80ch] text-[13px] leading-relaxed text-ink-3">
          One chronological stream, one row per event, each carrying who acted, what happened,
          what it referenced and how it ended. Detection, investigation, recommendation,
          approval, gateway call, failure, fallback and recovery are all in here — an auditor
          can reconstruct a decision without opening another screen.
        </p>
      </div>

      <AuditStream baseEvents={events} />
    </div>
  );
}
