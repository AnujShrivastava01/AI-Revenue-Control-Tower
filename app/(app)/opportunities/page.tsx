import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { getOpportunities } from "@/lib/analytics/opportunities";
import { getOverviewMetrics } from "@/lib/analytics/metrics";
import { formatPercent, formatShortINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  const opportunities = getOpportunities();
  const m = getOverviewMetrics();
  const total = opportunities.reduce((a, o) => a + o.value, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">Opportunities</h1>
          <p className="mt-1.5 max-w-[76ch] text-[13px] leading-relaxed text-ink-3">
            The same findings as the alerts, expressed as money that is still retrievable and
            ranked by expected financial value rather than by severity. Each one states the
            basis of its estimate.
          </p>
        </div>
        <dl className="flex flex-wrap gap-8">
          <div>
            <dt className="eyebrow mb-1">Total identified</dt>
            <dd className="text-[19px] font-semibold text-ok tnum">{formatShortINR(total)}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Recovered to date</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">
              {formatShortINR(m.recovered)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        {opportunities.map((o, i) => (
          <Panel key={o.id}>
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
              <span className="w-5 shrink-0 font-mono text-[11px] text-ink-4 tnum">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="w-full shrink-0 lg:w-[190px]">
                <div className="text-[24px] font-semibold leading-none tracking-[-0.028em] text-ink tnum">
                  {formatShortINR(o.value)}
                </div>
                <div className="mt-1.5 eyebrow">{o.title}</div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-ink-2">{o.subject}</p>
                <p className="mt-1 max-w-[80ch] text-[13px] leading-relaxed text-ink-3">
                  {o.detail}
                </p>
                <p className="mt-1.5 text-[12px] text-ink-4">Basis: {o.basis}</p>
              </div>

              <div className="flex shrink-0 items-center gap-5">
                <div className="text-right">
                  <div className="eyebrow mb-1">Confidence</div>
                  <div className="text-[15px] font-semibold text-ink tnum">
                    {formatPercent(o.confidence, 0)}
                  </div>
                </div>
                <Link
                  href={o.cta.href}
                  className="group inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-line-strong px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-raised"
                >
                  {o.cta.label}
                  <ArrowRight
                    size={14}
                    strokeWidth={2}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
