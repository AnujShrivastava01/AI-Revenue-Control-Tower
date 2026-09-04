import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Panel, PanelHeader, StatusDot } from "@/components/ui/primitives";
import { listInvestigations } from "@/lib/ai/investigator";
import { getOverviewMetrics } from "@/lib/analytics/metrics";
import { formatPercent, formatShortINR, timeIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Investigations" };
export const dynamic = "force-dynamic";

const SEVERITY_TONE = { critical: "danger", watch: "warn", opportunity: "ok" } as const;

export default function InvestigationsPage() {
  const investigations = listInvestigations();
  const m = getOverviewMetrics();
  const openImpact = investigations.reduce((a, i) => a + i.impact, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">Investigations</h1>
          <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
            Each open case started as a signal that left this merchant&apos;s learned band. Every
            one carries its own evidence, tested hypotheses and priced alternatives.
          </p>
        </div>
        <dl className="flex gap-8">
          <div>
            <dt className="eyebrow mb-1">Open</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">{investigations.length}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Combined impact</dt>
            <dd className="text-[19px] font-semibold text-danger tnum">
              {formatShortINR(openImpact)}
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Run to date</dt>
            <dd className="text-[19px] font-semibold text-ink tnum">{m.investigations}</dd>
          </div>
        </dl>
      </div>

      <Panel>
        <PanelHeader title="Open cases" meta="Ranked by financial impact" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <caption className="sr-only">Open investigations ranked by financial impact</caption>
            <thead>
              <tr className="border-b border-line text-left">
                {["Case", "Severity", "Status", "Root cause", "Affected", "Impact", "Recoverable", "Confidence", ""].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-3"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {investigations.map((inv) => (
                <tr key={inv.id} className="border-b border-line last:border-b-0 hover:bg-raised">
                  <td className="px-4 py-3 align-top">
                    <Link href={`/investigations/${inv.id}`} className="block">
                      <span className="block text-[13.5px] font-medium text-ink">{inv.title}</span>
                      <span className="block font-mono text-[11px] text-ink-4">
                        {inv.id} · opened {timeIST(inv.openedAt)} IST
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge tone={SEVERITY_TONE[inv.severity]}>{inv.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                      <StatusDot tone={inv.status === "action_pending" ? "warn" : "accent"} />
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="max-w-[240px] px-4 py-3 align-top text-[12.5px] text-ink-3">
                    {inv.rootCause.statement}
                  </td>
                  <td className="px-4 py-3 align-top text-[13px] text-ink tnum">
                    {inv.affectedCount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 align-top text-[13px] font-medium text-danger tnum">
                    {formatShortINR(inv.impact)}
                  </td>
                  <td className="px-4 py-3 align-top text-[13px] font-medium text-ok tnum">
                    {formatShortINR(inv.recoverable)}
                  </td>
                  <td className="px-4 py-3 align-top text-[13px] text-ink-2 tnum">
                    {formatPercent(inv.confidence, 0)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/investigations/${inv.id}`}
                      className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-ink hover:text-accent"
                      aria-label={`Open ${inv.title}`}
                    >
                      Open
                      <ArrowRight
                        size={13}
                        strokeWidth={2}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
