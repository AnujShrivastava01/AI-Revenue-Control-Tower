import { NextResponse } from "next/server";
import { observe } from "@/lib/ai/observer";
import { detectAnomalies } from "@/lib/ai/anomalyDetector";
import { getInvestigation } from "@/lib/ai/investigator";
import { upiScenarios } from "@/lib/ai/counterfactualEngine";
import { getRecommendation } from "@/lib/ai/decisionEngine";
import { getMerchantMemory } from "@/lib/ai/merchantMemory";
import { DEMO_NOW } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

/**
 * Runs the detection pipeline end to end against the seeded ledger and reports
 * what each stage actually did. Nothing is mutated — the point is to show the
 * loop running, not to fabricate a new incident.
 */
export function POST() {
  const stages: { stage: string; label: string; ms: number; detail: string }[] = [];

  const t0 = performance.now();
  const snapshot = observe();
  stages.push({
    stage: "observe",
    label: "Observe — reduce ledger to signals",
    ms: Math.max(1, Math.round(performance.now() - t0)),
    detail: `${snapshot.transactionsScanned.toLocaleString("en-IN")} transactions, ${snapshot.observations.length} signals`,
  });

  const t1 = performance.now();
  const memory = getMerchantMemory();
  stages.push({
    stage: "remember",
    label: "Remember — load learned baselines",
    ms: Math.max(1, Math.round(performance.now() - t1)),
    detail: `${memory.length} baselines, ${memory.filter((m) => m.status !== "normal").length} outside band`,
  });

  const t2 = performance.now();
  const anomalies = detectAnomalies();
  stages.push({
    stage: "detect",
    label: "Detect — compare against baselines",
    ms: Math.max(1, Math.round(performance.now() - t2)),
    detail: `${anomalies.length} anomalies, ${anomalies.filter((a) => a.severity === "critical").length} critical`,
  });

  const t3 = performance.now();
  const investigation = getInvestigation("inv_1042")!;
  stages.push({
    stage: "investigate",
    label: "Investigate — assemble evidence",
    ms: Math.max(1, Math.round(performance.now() - t3)),
    detail: `${investigation.evidence.length} evidence items, ${investigation.rootCause.alternativesConsidered.length} hypotheses tested`,
  });

  const t4 = performance.now();
  const scenarios = upiScenarios();
  stages.push({
    stage: "simulate",
    label: "Simulate — score counterfactuals",
    ms: Math.max(1, Math.round(performance.now() - t4)),
    detail: `${scenarios.length} scenarios scored on net expected benefit`,
  });

  const t5 = performance.now();
  const recommendation = getRecommendation("inv_1042");
  stages.push({
    stage: "recommend",
    label: "Recommend — select and bound an action",
    ms: Math.max(1, Math.round(performance.now() - t5)),
    detail: `${recommendation.statement} → ${recommendation.linkedActionId}`,
  });

  return NextResponse.json({
    ranAt: DEMO_NOW,
    stages,
    anomalyId: "anm_upi_degradation",
    investigationId: "inv_1042",
    recommendation,
  });
}
