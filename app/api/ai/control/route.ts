import { NextResponse } from "next/server";
import { observe } from "@/lib/ai/observer";
import { detectAnomalies } from "@/lib/ai/anomalyDetector";
import { listInvestigations } from "@/lib/ai/investigator";
import { getActions } from "@/lib/ai/decisionEngine";
import { getMerchantMemory } from "@/lib/ai/merchantMemory";
import { formatINR, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BREACHED = new Set([
  "failure_rate",
  "success_rate_since_onset",
  "bankx_failure_share",
  "product_refund_rate",
  "checkout_conversion",
  "settlement_variance",
]);

export function GET() {
  const snapshot = observe();
  const anomalies = detectAnomalies();
  const investigations = listInvestigations();
  const actions = getActions();
  void getMerchantMemory();

  return NextResponse.json({
    takenAt: snapshot.takenAt,
    transactionsScanned: snapshot.transactionsScanned,
    signalsEvaluated: snapshot.signalsEvaluated,
    investigationsActive: investigations.filter((i) => i.status !== "resolved").length,
    actionsAwaitingApproval: actions.filter((a) => a.status === "pending_approval").length,
    anomalies: anomalies.length,
    observations: snapshot.observations.map((o) => ({
      key: o.key,
      label: o.label,
      display:
        o.unit === "percent"
          ? formatPercent(o.value)
          : o.unit === "inr"
            ? formatINR(o.value)
            : o.unit === "days"
              ? `${o.value.toFixed(1)} d`
              : o.value.toLocaleString("en-IN"),
      window: o.window,
      sampleSize: o.sampleSize,
      status: BREACHED.has(o.key) ? "breached" : "normal",
    })),
    pipeline: [
      { stage: "Observe", module: "lib/ai/observer.ts", state: "running" },
      { stage: "Remember", module: "lib/ai/merchantMemory.ts", state: "loaded" },
      { stage: "Detect", module: "lib/ai/anomalyDetector.ts", state: "running" },
      { stage: "Investigate", module: "lib/ai/investigator.ts", state: `${investigations.length} open` },
      { stage: "Simulate", module: "lib/ai/counterfactualEngine.ts", state: "scored" },
      { stage: "Recommend", module: "lib/ai/decisionEngine.ts", state: "ready" },
      { stage: "Approve", module: "lib/policies/policyEngine.ts", state: "gating" },
      { stage: "Act", module: "lib/ai/actionExecutor.ts", state: "idle" },
      { stage: "Verify", module: "lib/ai/verification.ts", state: "idle" },
      { stage: "Learn", module: "lib/ai/merchantMemory.ts", state: "queued" },
    ],
  });
}
