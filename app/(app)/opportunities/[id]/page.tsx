import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { getOpportunity } from "@/lib/analytics/opportunities";
import { getChargebackStats, getReceivablesStats } from "@/lib/analytics/metrics";
import { getDataset } from "@/lib/demo/dataset";
import { dateIST, formatINR, formatPercent, formatShortINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const o = getOpportunity(id);
  return { title: o ? o.title : "Opportunity" };
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = getOpportunity(id);
  if (!opportunity) notFound();

  const ds = getDataset();
  const receivables = getReceivablesStats();
  const chargebacks = getChargebackStats();
  const isReceivables = id === "opp_receivables";

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/opportunities" className="text-xxs uppercase tracking-wider text-ink-4 hover:text-ink">
          Opportunities
        </Link>
        <span className="text-ink-4">/</span>
        <span className="font-mono text-[11px] text-ink-3">{opportunity.id}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-[-0.028em] text-ink">
            {opportunity.title}
          </h1>
          <p className="mt-2 max-w-[76ch] text-[13.5px] leading-relaxed text-ink-3">
            {opportunity.detail}
          </p>
          <p className="mt-1.5 text-[12px] text-ink-4">Basis: {opportunity.basis}</p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="eyebrow mb-1">Value</dt>
            <dd className="text-[22px] font-semibold leading-none text-ok tnum">
              {formatShortINR(opportunity.value)}
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Confidence</dt>
            <dd className="text-[22px] font-semibold leading-none text-ink tnum">
              {formatPercent(opportunity.confidence, 0)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        {isReceivables ? (
          <Panel>
            <PanelHeader
              title="Overdue invoices"
              meta={`${receivables.count} open · ${formatINR(receivables.value)} · average ${receivables.avgDaysOverdue} days past due`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <caption className="sr-only">Overdue invoices</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    {["Invoice", "Customer", "Amount", "Issued", "Due", "Days overdue", "Collection band"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receivables.overdue
                    .slice()
                    .sort((a, b) => b.daysOverdue - a.daysOverdue)
                    .map((inv) => (
                      <tr key={inv.id} className="border-b border-line last:border-b-0 hover:bg-raised">
                        <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-2">{inv.id}</td>
                        <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-3">
                          {inv.customerId}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] font-medium text-ink tnum">
                          {formatINR(inv.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-ink-3 tnum">
                          {dateIST(inv.issuedAt)}
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-ink-3 tnum">
                          {dateIST(inv.dueAt)}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-ink tnum">{inv.daysOverdue}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={inv.daysOverdue > 60 ? "danger" : inv.daysOverdue > 30 ? "warn" : "ok"}>
                            {inv.daysOverdue > 60 ? "low recovery" : inv.daysOverdue > 30 ? "declining" : "collectable"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title="Open disputes"
              meta={`${chargebacks.chargebacks.length} disputes · ${formatINR(chargebacks.exposure)} exposure`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <caption className="sr-only">Chargebacks under representment</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    {["Dispute", "Transaction", "Amount", "Reason code", "Raised", "Status"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chargebacks.chargebacks.map((c) => {
                    const txn = ds.byId.get(c.transactionId);
                    return (
                      <tr key={c.id} className="border-b border-line last:border-b-0 hover:bg-raised">
                        <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-2">{c.id}</td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/investigations/inv_1042?txn=${c.transactionId}`}
                            className="font-mono text-[11.5px] text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                          >
                            {c.transactionId}
                          </Link>
                          {txn ? (
                            <span className="ml-2 text-xxs text-ink-4">
                              {txn.method.toUpperCase()}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] font-medium text-ink tnum">
                          {formatINR(c.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-ink-3">{c.reasonCode}</td>
                        <td className="px-4 py-2.5 text-[12.5px] text-ink-3 tnum">
                          {dateIST(c.createdAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={c.status === "open" ? "warn" : c.status === "lost" ? "danger" : "accent"}>
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
