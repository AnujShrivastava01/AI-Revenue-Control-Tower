"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown, Loader2 } from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/primitives";
import { AiControlPanel } from "./ai-control";
import { cn } from "@/lib/utils";
import type { RazorpayModeInfo } from "@/lib/razorpay/client";
import type { AiStatus } from "@/lib/ai/llm";

export interface SearchHit {
  id: string;
  kind: string;
  label: string;
  detail: string;
  href: string;
}

const RANGES = [
  { key: "today", label: "Today · 00:00 – 16:45 IST" },
  { key: "14d", label: "Last 14 days" },
  { key: "42d", label: "Last 42 days" },
];

export function TopBar({
  gateway,
  ai,
  merchant,
}: {
  gateway: RazorpayModeInfo;
  ai: AiStatus;
  merchant: { name: string; id: string; mcc: string; legalName: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range = params.get("range") ?? "today";

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ q: string; hits: SearchHit[] } | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<null | "range" | "merchant">(null);
  const [aiOpen, setAiOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setDismissed(true);
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const trimmed = query.trim();
  // Results are only shown for the query they were fetched for, so a stale
  // response can never be rendered against newer input.
  const hits = dismissed || trimmed.length < 2 || results?.q !== trimmed ? null : results.hits;

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { hits: SearchHit[] };
        if (!cancelled) setResults({ q, hits: json.hits });
      } catch {
        if (!cancelled) setResults({ q, hits: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function setRange(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "today") next.delete("range");
    else next.set("range", key);
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
    setOpenMenu(null);
  }

  return (
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm lg:px-6">
      <div ref={boxRef} className="relative w-full max-w-[380px]">
        <label htmlFor="global-search" className="sr-only">
          Search transactions, investigations and actions
        </label>
        <Search
          size={14}
          strokeWidth={1.9}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4"
        />
        <input
          id="global-search"
          value={query}
          onChange={(e) => {
            setDismissed(false);
            setQuery(e.target.value);
          }}
          placeholder="Search TXN_82931, inv_1042, act_2041…"
          className="h-8 w-full rounded-[4px] border border-line bg-raised pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-4 focus:border-line-strong focus:bg-surface focus:outline-none focus-visible:outline-none"
          autoComplete="off"
        />
        {searching ? (
          <Loader2
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-ink-4"
          />
        ) : null}
        {hits ? (
          <div className="absolute left-0 right-0 top-[38px] z-30 overflow-hidden rounded-md border border-line bg-surface shadow-pop animate-fade-up">
            {hits.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-ink-3">
                Nothing matched “{query}”. Try a transaction, investigation or action id.
              </p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto py-1">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      href={hit.href}
                      onClick={() => {
                        setQuery("");
                        setResults(null);
                      }}
                      className="flex items-baseline justify-between gap-3 px-3 py-2 hover:bg-raised"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[12px] text-ink">
                          {hit.label}
                        </span>
                        <span className="block truncate text-xxs text-ink-3">{hit.detail}</span>
                      </span>
                      <span className="shrink-0 text-2xs uppercase tracking-wider text-ink-4">
                        {hit.kind}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative hidden md:block">
          <button
            onClick={() => setOpenMenu(openMenu === "range" ? null : "range")}
            aria-expanded={openMenu === "range"}
            className="flex h-8 items-center gap-1.5 rounded-[4px] border border-line px-2.5 text-[12.5px] text-ink-2 hover:bg-raised"
          >
            {RANGES.find((r) => r.key === range)?.label ?? RANGES[0].label}
            <ChevronDown size={13} strokeWidth={1.9} className="text-ink-4" />
          </button>
          {openMenu === "range" ? (
            <div className="absolute right-0 top-9 z-30 w-[220px] overflow-hidden rounded-md border border-line bg-surface py-1 shadow-pop animate-fade-up">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "flex w-full items-center px-3 py-1.5 text-left text-[13px] hover:bg-raised",
                    r.key === range ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => setAiOpen(true)}
          className="flex h-8 items-center gap-2 rounded-[4px] border border-line px-2.5 text-[12.5px] text-ink-2 hover:bg-raised"
        >
          <StatusDot tone={ai.enabled ? "accent" : "ok"} pulse />
          <span className="hidden sm:inline">
            {ai.enabled ? "LLM-assisted" : "Deterministic"}
          </span>
        </button>

        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === "merchant" ? null : "merchant")}
            aria-expanded={openMenu === "merchant"}
            className="flex h-8 items-center gap-1.5 rounded-[4px] border border-line px-2.5 text-[12.5px] font-medium text-ink hover:bg-raised"
          >
            {merchant.name}
            <ChevronDown size={13} strokeWidth={1.9} className="text-ink-4" />
          </button>
          {openMenu === "merchant" ? (
            <div className="absolute right-0 top-9 z-30 w-[280px] rounded-md border border-line bg-surface p-3 shadow-pop animate-fade-up">
              <div className="text-[13px] font-medium text-ink">{merchant.legalName}</div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-4">{merchant.id}</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={gateway.mode === "test" ? "ok" : "warn"}>
                  {gateway.mode === "test" ? "Live test mode" : "Sandbox data"}
                </Badge>
                <span className="text-xxs text-ink-3">MCC {merchant.mcc}</span>
              </div>
              <p className="mt-2.5 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-ink-3">
                One merchant exists in this environment. Multi-merchant selection
                would read from the Merchant table without any change to these screens.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <AiControlPanel open={aiOpen} onClose={() => setAiOpen(false)} ai={ai} />
    </header>
  );
}
