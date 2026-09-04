import { NextResponse, type NextRequest } from "next/server";
import { getDataset } from "@/lib/demo/dataset";
import { listInvestigations } from "@/lib/ai/investigator";
import { getActions } from "@/lib/ai/decisionEngine";
import { getMerchantMemory } from "@/lib/ai/merchantMemory";
import { formatINR, timeIST } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Entity lookup across the ledger and the intelligence layer. */
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const ds = getDataset();
  const hits: {
    id: string;
    kind: string;
    label: string;
    detail: string;
    href: string;
  }[] = [];

  for (const inv of listInvestigations()) {
    if (inv.id.toLowerCase().includes(q) || inv.title.toLowerCase().includes(q)) {
      hits.push({
        id: inv.id,
        kind: "Investigation",
        label: `${inv.id} · ${inv.title}`,
        detail: `${inv.severity} · ${inv.affectedCount.toLocaleString("en-IN")} affected`,
        href: `/investigations/${inv.id}`,
      });
    }
  }

  for (const action of getActions()) {
    if (action.id.toLowerCase().includes(q) || action.title.toLowerCase().includes(q)) {
      hits.push({
        id: action.id,
        kind: "Action",
        label: `${action.id} · ${action.title}`,
        detail: `${action.status.replace(/_/g, " ")} · ${formatINR(action.expectedRecovery)} expected`,
        href: `/actions/${action.id}`,
      });
    }
  }

  for (const mem of getMerchantMemory()) {
    if (mem.title.toLowerCase().includes(q) || mem.key.includes(q)) {
      hits.push({
        id: mem.id,
        kind: "Memory",
        label: mem.title,
        detail: `${mem.baselineValue} → ${mem.currentValue}`,
        href: `/memory?open=${mem.id}`,
      });
    }
  }

  // Transactions: exact-ish id match first, then a bounded scan.
  const upper = q.toUpperCase();
  const direct = ds.byId.get(upper) ?? ds.byId.get(`TXN_${upper.replace(/^TXN_/, "")}`);
  if (direct) {
    hits.unshift({
      id: direct.id,
      kind: "Transaction",
      label: direct.id,
      detail: `${formatINR(direct.amount)} · ${direct.method.toUpperCase()} · ${direct.status} · ${timeIST(direct.createdAt)}`,
      href: `/investigations/inv_1042?txn=${direct.id}`,
    });
  } else if (/^txn|^\d/.test(q)) {
    for (const t of ds.transactions) {
      if (hits.length > 14) break;
      if (t.id.toLowerCase().includes(q)) {
        hits.push({
          id: t.id,
          kind: "Transaction",
          label: t.id,
          detail: `${formatINR(t.amount)} · ${t.method.toUpperCase()} · ${t.status} · ${timeIST(t.createdAt)}`,
          href: `/investigations/inv_1042?txn=${t.id}`,
        });
      }
    }
  }

  return NextResponse.json({ hits: hits.slice(0, 12) });
}
