"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Zap, ExternalLink, Check } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Badge, Button, KeyValue, Mono, StatusDot } from "@/components/ui/primitives";
import { useSession } from "@/components/state/session";
import { POLICY_LIMITS } from "@/lib/policies/policyEngine";
import type { RazorpayModeInfo } from "@/lib/razorpay/client";
import type { AiStatus } from "@/lib/ai/llm";

interface TriggerResult {
  ranAt: string;
  stages: { stage: string; label: string; ms: number; detail: string }[];
  anomalyId: string;
  investigationId: string;
}

/**
 * Environment and demo controls. Deliberately tucked behind a settings entry
 * rather than shown on the surfaces a judge is meant to read.
 */
export function EnvironmentPanel({
  open,
  onClose,
  gateway,
  ai,
}: {
  open: boolean;
  onClose: () => void;
  gateway: RazorpayModeInfo;
  ai: AiStatus;
}) {
  const { reset, state } = useSession();
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [trigger, setTrigger] = React.useState<TriggerResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [didReset, setDidReset] = React.useState(false);

  const sessionActions = Object.keys(state.actions).length;

  async function runPipeline() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/trigger", { method: "POST" });
      if (!res.ok) throw new Error(`Pipeline returned ${res.status}`);
      setTrigger((await res.json()) as TriggerResult);
    } catch {
      setError("Unable to run the detection pipeline. The server did not respond.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Environment"
      subtitle="Data source, gateway mode, model status and demo controls"
    >
      <div className="space-y-6">
        <section>
          <h3 className="eyebrow mb-2.5">Data</h3>
          <div className="rounded-md border border-line bg-raised p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone="warn">Synthetic / test environment</Badge>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-3">
              10,000 transactions, 3,200 customers, 42 days of daily history, all generated
              from a fixed seed. Identical on every run and every machine. No real merchant
              or customer data is present.
            </p>
          </div>
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Gateway</h3>
          <div className="rounded-md border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <StatusDot tone={gateway.mode === "test" ? "ok" : "warn"} />
              <span className="text-[13px] font-medium text-ink">{gateway.label}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-3">{gateway.detail}</p>
            {gateway.keyIdPreview ? (
              <div className="mt-2">
                <Mono>{gateway.keyIdPreview}</Mono>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Reasoning</h3>
          <div className="rounded-md border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <StatusDot tone={ai.enabled ? "accent" : "neutral"} />
              <span className="text-[13px] font-medium text-ink">{ai.label}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-3">{ai.detail}</p>
          </div>
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Active policy</h3>
          <div className="rounded-md border border-line p-3">
            <KeyValue
              columns={2}
              items={[
                { label: "Policy", value: "RECOVERY_V2 · 2.3", mono: true },
                { label: "Max auto amount", value: `₹${POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT.toLocaleString("en-IN")}` },
                { label: "Max retries", value: String(POLICY_LIMITS.MAX_RETRY_ATTEMPTS) },
                { label: "Max discount", value: `${POLICY_LIMITS.MAX_DISCOUNT_PERCENT}%` },
                { label: "Blast radius", value: `${POLICY_LIMITS.MAX_CUSTOMERS_PER_ACTION} customers` },
                { label: "Approval", value: "Required above low risk" },
              ]}
            />
          </div>
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Demo controls</h3>
          <div className="space-y-2">
            <div className="rounded-md border border-line p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Zap size={14} strokeWidth={1.75} className="text-ink-3" />
                <span className="text-[13px] font-medium text-ink">Trigger incident</span>
              </div>
              <p className="mb-3 text-[13px] leading-relaxed text-ink-3">
                Re-runs the live pipeline — observe, detect, investigate, score, recommend —
                over the seeded ledger and reports what each stage took.
              </p>
              <Button onClick={runPipeline} disabled={running}>
                {running ? "Running pipeline…" : "Run detection pipeline"}
              </Button>
              {error ? (
                <p role="alert" className="mt-2 text-[12.5px] text-danger">
                  {error}
                </p>
              ) : null}
              {trigger ? (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {trigger.stages.map((s) => (
                    <div key={s.stage} className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-ink-2">{s.label}</span>
                      <span className="font-mono text-[11px] text-ink-4 tnum">{s.ms} ms</span>
                    </div>
                  ))}
                  <Button
                    className="mt-2 w-full"
                    variant="primary"
                    onClick={() => {
                      onClose();
                      router.push(`/investigations/${trigger.investigationId}`);
                    }}
                  >
                    Open {trigger.investigationId}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-line p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <RotateCcw size={14} strokeWidth={1.75} className="text-ink-3" />
                <span className="text-[13px] font-medium text-ink">Reset demo</span>
              </div>
              <p className="mb-3 text-[13px] leading-relaxed text-ink-3">
                Clears approvals, execution results and session audit events.
                {sessionActions > 0
                  ? ` ${sessionActions} action${sessionActions === 1 ? "" : "s"} currently carry session state.`
                  : " Nothing has been executed in this session yet."}
              </p>
              <Button
                onClick={() => {
                  reset();
                  setDidReset(true);
                  setTimeout(() => setDidReset(false), 2200);
                  router.refresh();
                }}
              >
                {didReset ? (
                  <>
                    <Check size={14} strokeWidth={2} /> Reset
                  </>
                ) : (
                  "Reset demo"
                )}
              </Button>
            </div>

            <a
              href="/api/diagnostics"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-1 py-1 text-[12.5px] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
            >
              <ExternalLink size={13} strokeWidth={1.75} />
              Batch diagnostics (JSON)
            </a>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
