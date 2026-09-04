"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Layers, GitCompare, LineChart } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Badge, ErrorState, KeyValue, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { cn, dateTimeIST, formatINR, formatPercent, timeISTSeconds } from "@/lib/utils";
import type { EvidenceItem, PaymentEvent, Transaction, Customer, Product, Refund } from "@/lib/types";

const KIND_ICON = {
  transaction: FileText,
  aggregate: Layers,
  comparison: GitCompare,
  timeseries: LineChart,
} as const;

interface TxnPayload {
  transaction: Transaction;
  customer?: Customer;
  product?: Product;
  refund: Refund | null;
  events: PaymentEvent[];
}

export function EvidenceGrid({ evidence }: { evidence: EvidenceItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const deepLinked = params.get("txn");

  // A transaction id in the URL opens straight onto that piece of evidence.
  // Resolved at mount: within the page the drawer is driven by state, and
  // arriving from elsewhere is a navigation, which remounts.
  const [openId, setOpenId] = React.useState<string | null>(
    () => evidence.find((e) => e.transactionId === deepLinked)?.id ?? null,
  );
  const [externalTxn, setExternalTxn] = React.useState<string | null>(() =>
    deepLinked && !evidence.some((e) => e.transactionId === deepLinked) ? deepLinked : null,
  );

  const active = evidence.find((e) => e.id === openId) ?? null;
  const transactionId = active?.transactionId ?? externalTxn ?? null;

  function close() {
    setOpenId(null);
    setExternalTxn(null);
    if (deepLinked) {
      const next = new URLSearchParams(params.toString());
      next.delete("txn");
      router.replace(next.toString() ? `?${next}` : "?", { scroll: false });
    }
  }

  return (
    <>
      <Panel>
        <PanelHeader
          title="Evidence"
          meta={`${evidence.length} items · ranked by weight`}
          action={
            <span className="text-xxs text-ink-4">Select an item for full detail</span>
          }
        />
        <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {evidence.map((item, i) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={item.id}
                className={cn(
                  "sm:border-b sm:border-line",
                  i % 2 === 0 ? "sm:border-r sm:border-line" : "",
                )}
              >
                <button
                  onClick={() => setOpenId(item.id)}
                  className="flex w-full flex-col items-start gap-1.5 px-4 py-3 text-left transition-colors hover:bg-raised"
                >
                  <span className="flex w-full items-center gap-2">
                    <Icon size={13} strokeWidth={1.8} className="shrink-0 text-ink-4" />
                    <span className="truncate font-mono text-[12px] text-ink">{item.label}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-4 tnum">
                      w {item.weight.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-[13px] leading-[1.5] text-ink-3">{item.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Drawer
        open={Boolean(active || externalTxn)}
        onClose={close}
        title={active?.label ?? transactionId ?? "Evidence"}
        subtitle={active ? `${active.kind} evidence · weight ${active.weight.toFixed(2)}` : "Transaction"}
        width="max-w-[520px]"
      >
        {active ? (
          <div className="space-y-5">
            <p className="text-[13px] leading-relaxed text-ink-2">{active.summary}</p>
            <div className="rounded-md border border-line p-3">
              <KeyValue columns={2} items={active.facts} />
            </div>
            {transactionId ? <TransactionDetail id={transactionId} /> : null}
          </div>
        ) : transactionId ? (
          <TransactionDetail id={transactionId} />
        ) : null}
      </Drawer>
    </>
  );
}

/** Keyed by transaction id so a new id remounts with a clean loading state. */
function TransactionDetail({ id }: { id: string }) {
  return <TransactionDetailBody key={id} id={id} />;
}

function TransactionDetailBody({ id }: { id: string }) {
  const [load, setLoad] = React.useState<{ data: TxnPayload | null; error: string | null }>({
    data: null,
    error: null,
  });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Not found");
        return r.json();
      })
      .then((json: TxnPayload) => {
        if (!cancelled) setLoad({ data: json, error: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setLoad({ data: null, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [id, nonce]);

  const { data, error } = load;

  if (error)
    return (
      <ErrorState
        title="Unable to retrieve this transaction."
        detail={`${id} could not be read from the ledger. ${error}`}
        onRetry={() => {
          setLoad({ data: null, error: null });
          setNonce((n) => n + 1);
        }}
      />
    );

  if (!data)
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );

  const t = data.transaction;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge tone={t.status === "captured" ? "ok" : "danger"}>{t.status}</Badge>
        {t.anomalyId ? <Badge tone="warn">Incident cohort</Badge> : null}
        {t.highIntent ? <Badge tone="accent">High intent</Badge> : null}
      </div>

      <div>
        <div className="text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink tnum">
          {formatINR(t.amount)}
        </div>
        <div className="mt-1.5 text-xxs text-ink-3">{dateTimeIST(t.createdAt)}</div>
      </div>

      <div className="rounded-md border border-line p-3">
        <KeyValue
          columns={2}
          items={[
            { label: "Transaction", value: t.id, mono: true },
            { label: "Method", value: t.method.toUpperCase() },
            { label: "Bank", value: t.bank === "BANKX" ? "Bank X (BANKX)" : t.bank, mono: true },
            { label: "Device", value: t.device },
            { label: "RRN", value: t.rrn ?? "—", mono: true },
            { label: "VPA", value: t.vpa ?? "—", mono: true },
            { label: "Customer", value: data.customer?.id ?? t.customerId, mono: true },
            { label: "Product", value: data.product?.name ?? t.productId },
            ...(t.errorCode ? [{ label: "Error code", value: t.errorCode, mono: true }] : []),
            ...(t.recoveryProbability !== undefined
              ? [{ label: "Recovery probability", value: formatPercent(t.recoveryProbability, 0) }]
              : []),
          ]}
        />
        {t.errorReason ? (
          <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-3">
            {t.errorReason}
          </p>
        ) : null}
      </div>

      {data.customer ? (
        <div className="rounded-md border border-line p-3">
          <h4 className="eyebrow mb-2.5">Customer</h4>
          <KeyValue
            columns={2}
            items={[
              { label: "Orders", value: String(data.customer.orders) },
              { label: "Lifetime value", value: formatINR(data.customer.lifetimeValue) },
              { label: "First seen", value: dateTimeIST(data.customer.firstSeenAt).split(" · ")[0] },
              { label: "Handle", value: data.customer.handle, mono: true },
            ]}
          />
        </div>
      ) : null}

      <div>
        <h4 className="eyebrow mb-2.5">Payment events</h4>
        <ol className="overflow-hidden rounded-md border border-line">
          {data.events.map((e) => (
            <li
              key={e.id}
              className="flex items-baseline gap-3 border-b border-line px-3 py-2 last:border-b-0"
            >
              <span className="shrink-0 font-mono text-[11px] text-ink-4 tnum">
                {timeISTSeconds(e.at)}
              </span>
              <span className="w-[70px] shrink-0 text-2xs uppercase tracking-wider text-ink-2">
                {e.type}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] text-ink-3">{e.detail}</span>
            </li>
          ))}
        </ol>
      </div>

      {data.refund ? (
        <div className="rounded-md border border-warn/25 bg-warn-soft p-3">
          <h4 className="eyebrow mb-2 text-warn">Refunded</h4>
          <KeyValue
            columns={2}
            items={[
              { label: "Refund", value: data.refund.id, mono: true },
              { label: "Amount", value: formatINR(data.refund.amount) },
              { label: "Reason", value: data.refund.reason },
              { label: "Status", value: data.refund.status },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
