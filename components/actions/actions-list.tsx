"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { useSession } from "@/components/state/session";
import { dateTimeIST, formatPercent, formatShortINR } from "@/lib/utils";
import type { ActionPlan, ActionStatus } from "@/lib/types";

const GROUPS: { key: ActionStatus; label: string; hint: string }[] = [
  { key: "pending_approval", label: "Pending approval", hint: "Waiting on a named human decision" },
  { key: "executing", label: "Executing", hint: "Currently running through the executor" },
  { key: "completed", label: "Completed", hint: "Executed and verified against the ledger" },
  { key: "failed", label: "Failed", hint: "Halted at the gateway or by policy on re-evaluation" },
  { key: "blocked_by_policy", label: "Blocked by policy", hint: "Never reached the executor" },
  { key: "rejected", label: "Rejected", hint: "Declined by the merchant" },
];

const STATUS_TONE: Record<ActionStatus, "neutral" | "ok" | "warn" | "danger" | "accent"> = {
  pending_approval: "warn",
  approved: "accent",
  executing: "accent",
  completed: "ok",
  failed: "danger",
  rejected: "neutral",
  blocked_by_policy: "danger",
};

const RISK_TONE = { low: "ok", medium: "warn", high: "danger" } as const;

export function ActionsList({ actions }: { actions: ActionPlan[] }) {
  const { state, hydrated } = useSession();

  const resolved = actions.map((a) => {
    const s = state.actions[a.id];
    return {
      ...a,
      status: s?.status ?? a.status,
      result: s?.result ?? a.result,
    };
  });

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => {
        const rows = resolved.filter((a) => a.status === group.key);
        if (rows.length === 0 && group.key !== "pending_approval") return null;
        return (
          <Panel key={group.key}>
            <PanelHeader
              title={group.label}
              meta={group.hint}
              action={
                <span className="text-[13px] font-medium text-ink tnum">{rows.length}</span>
              }
            />
            {rows.length === 0 ? (
              <EmptyState
                title="Nothing awaiting approval"
                detail="Every proposed action in this session has been decided. New actions appear here as the decision engine produces them."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <caption className="sr-only">{group.label} actions</caption>
                  <thead>
                    <tr className="border-b border-line text-left">
                      {["Action", "Amount", "Risk", "Created by", "Approval", "Result", ""].map((h) => (
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
                    {rows.map((a) => (
                      <tr key={a.id} className="border-b border-line last:border-b-0 hover:bg-raised">
                        <td className="px-4 py-3 align-top">
                          <Link href={`/actions/${a.id}`} className="block">
                            <span className="block text-[13.5px] font-medium text-ink">{a.title}</span>
                            <span className="block font-mono text-[11px] text-ink-4">
                              {a.id} · {dateTimeIST(a.createdAt)}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="block text-[13px] font-medium text-ink tnum">
                            {formatShortINR(a.expectedRecovery)}
                          </span>
                          <span className="block text-xxs text-ink-4 tnum">
                            of {formatShortINR(a.totalExposure)} exposure
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge tone={RISK_TONE[a.risk]}>{a.risk}</Badge>
                        </td>
                        <td className="px-4 py-3 align-top text-[12.5px] text-ink-3">
                          Decision engine
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="text-[12.5px] text-ink-2">
                            {a.requiresApproval ? "Human approval required" : "Not required"}
                          </span>
                          {a.approvedAt ? (
                            <span className="block font-mono text-[11px] text-ink-4">
                              {dateTimeIST(a.approvedAt)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {a.result ? (
                            <>
                              <Badge tone={a.result.ok ? "ok" : "danger"}>{a.result.code}</Badge>
                              <span className="mt-1 block text-xxs text-ink-3 tnum">
                                {a.result.ok
                                  ? `${formatShortINR(a.result.recoveredAmount)} recovered · ${a.result.succeeded}/${a.result.attempted}`
                                  : a.result.message.slice(0, 60)}
                              </span>
                            </>
                          ) : (
                            <Badge tone={STATUS_TONE[a.status]}>{a.status.replace(/_/g, " ")}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/actions/${a.id}`}
                            className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-ink hover:text-accent"
                            aria-label={`Open ${a.title}`}
                          >
                            {a.status === "pending_approval" ? "Review" : "Open"}
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
            )}
          </Panel>
        );
      })}

      {!hydrated ? (
        <p className="px-1 text-[12.5px] text-ink-4">Reading session state…</p>
      ) : (
        <p className="px-1 text-[12.5px] text-ink-4 tnum">
          {Object.keys(state.actions).length} action
          {Object.keys(state.actions).length === 1 ? "" : "s"} carry state from this session ·
          success probabilities are modelled at{" "}
          {formatPercent(actions[0]?.successProbability ?? 0, 0)} for the recommended recovery
        </p>
      )}
    </div>
  );
}
