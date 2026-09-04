"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, EmptyState, Panel, PanelHeader, StatusDot } from "@/components/ui/primitives";
import { useSession } from "@/components/state/session";
import { AUDIT_FILTERS, filterAuditEvents, type AuditFilterKey } from "@/lib/audit/events";
import { cn, dateIST, timeISTSeconds } from "@/lib/utils";
import type { AuditEvent } from "@/lib/types";

const ACTOR_TONE = {
  ai: "accent",
  merchant: "ok",
  api: "neutral",
  policy: "warn",
  system: "neutral",
} as const;

const RESULT_TONE = {
  ok: "ok",
  failed: "danger",
  blocked: "warn",
  info: "neutral",
} as const;

function refHref(event: AuditEvent): string | null {
  switch (event.refType) {
    case "investigation":
      return `/investigations/${event.refId}`;
    case "action":
      return `/actions/${event.refId}`;
    case "transaction":
      return `/investigations/inv_1042?txn=${event.refId}`;
    default:
      return null;
  }
}

export function AuditStream({ baseEvents }: { baseEvents: AuditEvent[] }) {
  const { state, hydrated } = useSession();
  const [filter, setFilter] = React.useState<AuditFilterKey>("all");

  const merged = React.useMemo(() => {
    const seen = new Set(baseEvents.map((e) => e.id));
    const extra = state.events.filter((e) => !seen.has(e.id));
    return [...baseEvents, ...extra].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [baseEvents, state.events]);

  const events = filterAuditEvents(merged, filter);
  const sessionIds = new Set(state.events.map((e) => e.id));

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: merged.length };
    for (const f of AUDIT_FILTERS) {
      if (f.key === "all") continue;
      map[f.key] = filterAuditEvents(merged, f.key).length;
    }
    return map;
  }, [merged]);

  // Group by calendar day for readability.
  const groups: { day: string; items: AuditEvent[] }[] = [];
  for (const e of events) {
    const day = dateIST(e.at);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter audit events">
        {AUDIT_FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[4px] border px-2.5 text-[12.5px] transition-colors",
              filter === f.key
                ? "border-ink bg-[#101216] text-white"
                : "border-line bg-surface text-ink-2 hover:bg-raised",
            )}
          >
            {f.label}
            <span
              className={cn(
                "font-mono text-[10px] tnum",
                filter === f.key ? "text-white/60" : "text-ink-4",
              )}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
        <span className="ml-auto text-[12.5px] text-ink-4 tnum">
          {hydrated && state.events.length > 0
            ? `${state.events.length} event${state.events.length === 1 ? "" : "s"} from this session`
            : "No session events yet — approve an action to add to the chain"}
        </span>
      </div>

      {events.length === 0 ? (
        <Panel>
          <EmptyState
            title="No events match this filter."
            detail="Try a different actor, or clear the filter to see the full chain."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Panel key={group.day}>
              <PanelHeader title={group.day} meta={`${group.items.length} events`} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] border-collapse">
                  <caption className="sr-only">Audit events for {group.day}</caption>
                  <thead>
                    <tr className="border-b border-line text-left">
                      {["Time", "Actor", "Event", "Detail", "Reference", "Result"].map((h) => (
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
                    {group.items.map((e) => {
                      const href = refHref(e);
                      const isSession = sessionIds.has(e.id);
                      return (
                        <tr
                          key={e.id}
                          className={cn(
                            "border-b border-line last:border-b-0 hover:bg-raised",
                            isSession && "bg-accent-soft/40",
                          )}
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-[11.5px] text-ink-3 tnum">
                            {timeISTSeconds(e.at)}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <span className="flex items-center gap-1.5 text-[12.5px] uppercase tracking-wider text-ink-2">
                              <StatusDot tone={ACTOR_TONE[e.actor]} />
                              {e.actor}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 align-top text-[13px] font-medium text-ink">
                            {e.event}
                          </td>
                          <td className="max-w-[420px] px-4 py-2.5 align-top text-[12.5px] leading-relaxed text-ink-3">
                            {e.detail}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 align-top">
                            {href ? (
                              <Link
                                href={href}
                                className="font-mono text-[11.5px] text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                              >
                                {e.refId}
                              </Link>
                            ) : (
                              <span className="font-mono text-[11.5px] text-ink-4">{e.refId}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <Badge tone={RESULT_TONE[e.result]}>{e.result}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
