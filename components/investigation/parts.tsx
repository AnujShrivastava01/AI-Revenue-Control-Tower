import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import {
  Badge,
  ButtonLink,
  KeyValue,
  Panel,
  PanelHeader,
  ShareComparison,
  StatusDot,
} from "@/components/ui/primitives";
import { cn, formatINR, formatPercent, formatShortINR, timeIST } from "@/lib/utils";
import type { Investigation, Scenario, TimelineEntry } from "@/lib/types";

const SEVERITY_TONE = { critical: "danger", watch: "warn", opportunity: "ok" } as const;
const STATUS_LABEL: Record<Investigation["status"], string> = {
  investigating: "Investigating",
  action_pending: "Action pending approval",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export function InvestigationHeader({ investigation }: { investigation: Investigation }) {
  const inv = investigation;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href="/investigations"
          className="text-xxs uppercase tracking-wider text-ink-4 hover:text-ink"
        >
          Investigations
        </Link>
        <span className="text-ink-4">/</span>
        <span className="font-mono text-[11px] text-ink-3">{inv.id}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.028em] text-ink">
            {inv.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[inv.severity]}>{inv.severity}</Badge>
            <span className="flex items-center gap-1.5 text-xxs uppercase tracking-wider text-ink-3">
              <StatusDot tone={inv.status === "resolved" ? "ok" : "accent"} pulse={inv.status !== "resolved"} />
              {STATUS_LABEL[inv.status]}
            </span>
            <span className="text-xxs text-ink-4 tnum">
              Opened {timeIST(inv.openedAt)} IST
            </span>
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: "Financial impact", value: formatShortINR(inv.impact), tone: "danger" as const },
            { label: "Recoverable", value: formatShortINR(inv.recoverable), tone: "ok" as const },
            { label: "Affected", value: inv.affectedCount.toLocaleString("en-IN") },
            { label: "Confidence", value: formatPercent(inv.confidence, 0) },
          ].map((s) => (
            <div key={s.label}>
              <dt className="eyebrow mb-1">{s.label}</dt>
              <dd
                className={cn(
                  "text-[19px] font-semibold leading-none tracking-[-0.02em] tnum",
                  s.tone === "danger" && "text-danger",
                  s.tone === "ok" && "text-ok",
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function SummaryPanel({
  summary,
  generatedBy,
}: {
  summary: string;
  generatedBy: "llm_assisted" | "deterministic";
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="AI finding"
        action={
          <Badge tone={generatedBy === "llm_assisted" ? "accent" : "neutral"}>
            {generatedBy === "llm_assisted" ? "LLM-assisted narration" : "Deterministic"}
          </Badge>
        }
      />
      <div className="px-5 py-4">
        <p className="text-[15px] leading-[1.62] tracking-[-0.005em] text-ink-2">{summary}</p>
      </div>
    </Panel>
  );
}

export function RootCausePanel({ investigation }: { investigation: Investigation }) {
  const rc = investigation.rootCause;
  return (
    <Panel>
      <PanelHeader title="Root cause" meta={`${rc.supportingEvidenceIds.length} supporting evidence items`} />
      <div className="space-y-5 px-4 py-4">
        <div>
          <div className="eyebrow mb-1.5">Most likely cause</div>
          <p className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{rc.statement}</p>
          <p className="mt-2 text-[13px] leading-[1.6] text-ink-3">{rc.mechanism}</p>
        </div>

        <div className="rounded-md border border-line bg-raised p-3.5">
          <ShareComparison
            label={rc.shareLabel}
            observed={rc.observedShare}
            baseline={rc.baselineShare}
          />
        </div>

        <div>
          <div className="eyebrow mb-2">Hypotheses tested</div>
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
            {rc.alternativesConsidered.map((alt) => (
              <li key={alt.hypothesis} className="px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                  {alt.verdict === "Rejected" ? (
                    <Minus size={12} strokeWidth={2.2} className="mt-1 shrink-0 text-ink-4" />
                  ) : (
                    <StatusDot tone="warn" className="mt-1.5" />
                  )}
                  <span className="text-[13px] font-medium text-ink">{alt.hypothesis}</span>
                  <span className="ml-auto shrink-0 text-2xs uppercase tracking-wider text-ink-4">
                    {alt.verdict}
                  </span>
                </div>
                <p className="mt-1 pl-[18px] text-[12.5px] leading-relaxed text-ink-3">
                  {alt.rejectedBecause}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

export function ImpactPanel({ investigation }: { investigation: Investigation }) {
  return (
    <Panel>
      <PanelHeader title="Financial impact" meta="Derived from the transaction ledger" />
      <dl className="divide-y divide-line">
        {investigation.metrics.map((metric) => (
          <div key={metric.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="min-w-0">
              <span className="block text-[13px] text-ink-2">{metric.label}</span>
              {metric.sub ? (
                <span className="block text-xxs text-ink-4 tnum">{metric.sub}</span>
              ) : null}
            </dt>
            <dd
              className={cn(
                "shrink-0 text-[15px] font-semibold tracking-[-0.015em] tnum",
                metric.tone === "danger" && "text-danger",
                metric.tone === "ok" && "text-ok",
                metric.tone === "warn" && "text-warn",
                !metric.tone && "text-ink",
              )}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line px-4 py-2.5 text-[12px] leading-relaxed text-ink-4">
        Estimates derived from synthetic test data. Recoverable value is an amount-weighted
        expectation over the affected cohort, not a guarantee.
      </p>
    </Panel>
  );
}

const ACTOR_TONE = { ai: "accent", merchant: "ok", api: "neutral", policy: "warn", system: "neutral" } as const;

export function TimelinePanel({ entries }: { entries: TimelineEntry[] }) {
  return (
    <Panel>
      <PanelHeader title="Investigation timeline" meta={`${entries.length} steps`} />
      <ol className="px-4 py-4">
        {entries.map((entry, i) => (
          <li key={entry.at} className="relative flex gap-3 pb-4 last:pb-0">
            {i < entries.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-[43px] top-[14px] h-full w-px bg-line"
              />
            ) : null}
            <span className="w-[34px] shrink-0 pt-[1px] text-right font-mono text-[11px] text-ink-4 tnum">
              {timeIST(entry.at)}
            </span>
            <span className="relative z-10 mt-[5px] shrink-0">
              <StatusDot tone={ACTOR_TONE[entry.actor]} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">{entry.label}</span>
              {entry.detail ? (
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">
                  {entry.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------- counterfactuals */

function ScenarioCard({ scenario, letter }: { scenario: Scenario; letter: string }) {
  const isDoNothing = scenario.key === "do_nothing";
  return (
    <div
      className={cn(
        "flex flex-col rounded-md border bg-surface p-4",
        scenario.recommended ? "border-ink shadow-card" : "border-line",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">
          Scenario {letter}
        </span>
        {scenario.recommended ? (
          <Badge tone="accent">
            <Check size={11} strokeWidth={2.4} /> Recommended
          </Badge>
        ) : (
          <span className="text-2xs uppercase tracking-wider text-ink-4">
            {scenario.customerContactRisk === "none"
              ? "No contact"
              : `${scenario.customerContactRisk} contact risk`}
          </span>
        )}
      </div>

      <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-ink">{scenario.name}</h3>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-3">{scenario.description}</p>

      <dl className="mt-4 space-y-2 border-t border-line pt-3">
        {isDoNothing ? (
          <>
            <Row label="Expected additional loss" value={formatShortINR(scenario.expectedAdditionalLoss)} tone="danger" />
            <Row label="Probability" value={formatPercent(scenario.probability, 0)} />
          </>
        ) : (
          <>
            <Row label="Expected recovery" value={formatShortINR(scenario.expectedRecovery)} tone="ok" />
            <Row label="Expected cost" value={formatShortINR(scenario.expectedCost)} />
            <Row
              label="Net expected benefit"
              value={formatShortINR(scenario.netExpectedBenefit)}
              tone="ok"
              strong
            />
          </>
        )}
      </dl>

      <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
        {scenario.assumptions.map((a) => (
          <li key={a} className="flex gap-2 text-[12px] leading-relaxed text-ink-3">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-4" />
            {a}
          </li>
        ))}
      </ul>

      {scenario.linkedActionId ? (
        <div className="mt-4">
          <ButtonLink
            href={`/actions/${scenario.linkedActionId}`}
            variant={scenario.recommended ? "primary" : "secondary"}
            size="sm"
          >
            {scenario.recommended ? "Review action" : "Review this option"}
            <ArrowRight size={13} strokeWidth={2} />
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger";
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd
        className={cn(
          "text-[14px] tnum",
          strong ? "font-semibold" : "font-medium",
          tone === "ok" && "text-ok",
          tone === "danger" && "text-danger",
          !tone && "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function CounterfactualSection({ investigation }: { investigation: Investigation }) {
  const letters = ["A", "B", "C", "D"];
  const rec = investigation.recommendation;
  const best = investigation.scenarios.find((s) => s.recommended);

  return (
    <section aria-labelledby="whatif-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="whatif-heading"
            className="text-[19px] font-semibold tracking-[-0.02em] text-ink"
          >
            What if?
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            Compare possible actions before taking them. Doing nothing is scored on the same
            terms as intervening.
          </p>
        </div>
        <span className="text-xxs text-ink-4">
          Scored by lib/ai/counterfactualEngine.ts · deterministic
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {investigation.scenarios.map((s, i) => (
          <ScenarioCard key={s.id} scenario={s} letter={letters[i]} />
        ))}
      </div>

      <div className="mt-3 rounded-md border border-ink bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-[62ch]">
            <div className="eyebrow mb-1.5">AI recommendation</div>
            <p className="text-[16px] font-semibold tracking-[-0.015em] text-ink">
              {rec.statement}
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-3">{rec.reason}</p>
            <p className="mt-2.5 text-[12px] text-ink-4">
              Generated by the deterministic decision engine and bounded before it reaches a
              human. The language model cannot execute or widen this action.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2">
            <ButtonLink href={`/actions/${rec.linkedActionId}`} variant="primary" size="lg">
              Review action
              <ArrowRight size={15} strokeWidth={2} />
            </ButtonLink>
            {best ? (
              <span className="text-xxs text-ink-4 tnum">
                {formatINR(best.netExpectedBenefit)} net expected benefit
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SegmentPanel({ investigation }: { investigation: Investigation }) {
  return (
    <Panel>
      <PanelHeader title="Segment breakdown" meta="Incident cohort vs baseline failures" />
      <div className="space-y-4 px-4 py-4">
        {investigation.segmentBreakdown.map((seg) => (
          <ShareComparison
            key={seg.label}
            label={seg.label}
            observed={seg.incident}
            baseline={seg.baseline}
            tone={seg.incident > seg.baseline ? "danger" : "accent"}
          />
        ))}
      </div>
    </Panel>
  );
}

export function KeyFactsPanel({ items }: { items: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <Panel>
      <PanelHeader title="Cohort" meta="Re-derived from the ledger" />
      <div className="px-4 py-4">
        <KeyValue columns={2} items={items} />
      </div>
    </Panel>
  );
}
