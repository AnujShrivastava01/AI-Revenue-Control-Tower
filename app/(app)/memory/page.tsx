import { Suspense } from "react";
import type { Metadata } from "next";
import { MemoryGrid } from "@/components/memory/memory-grid";
import { Skeleton } from "@/components/ui/primitives";
import { getMerchantMemory } from "@/lib/ai/merchantMemory";
import { getDataset } from "@/lib/demo/dataset";
import { BATCH_TOTALS } from "@/lib/demo/config";

export const metadata: Metadata = { title: "Merchant Memory" };
export const dynamic = "force-dynamic";

export default function MemoryPage() {
  const records = getMerchantMemory();
  const ds = getDataset();
  const outside = records.filter((r) => r.status !== "normal").length;
  const observations = ds.daily.slice(0, -1).reduce((a, d) => a + d.transactions, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="max-w-[26ch] text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink">
            What the AI knows about your business
          </h1>
          <p className="mt-2 max-w-[78ch] text-[13px] leading-relaxed text-ink-3">
            Learned from {BATCH_TOTALS.historyDays} days of transaction history. These
            baselines are what turn a number into a signal: an 8.9% refund rate means nothing on
            its own, and everything against a 3.7% baseline this merchant held for 33 days.
            Every anomaly card elsewhere in the product is a comparison against something here.
          </p>
        </div>
        <dl className="flex flex-wrap gap-8">
          <div>
            <dt className="eyebrow mb-1">Baselines</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">{records.length}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Outside band</dt>
            <dd className="text-[19px] font-semibold text-danger tnum">{outside}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Observations</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">
              {observations.toLocaleString("en-IN")}
            </dd>
          </div>
        </dl>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MemoryGrid records={records} />
      </Suspense>

      <p className="mt-4 max-w-[80ch] text-[12px] leading-relaxed text-ink-4">
        Baselines are recomputed after every verified action. When the 12 February recovery
        completed, the recovery model was recalibrated on 96 new observations — that update is
        in the audit trail.
      </p>
    </div>
  );
}
