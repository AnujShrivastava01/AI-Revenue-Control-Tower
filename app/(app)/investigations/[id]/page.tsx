import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import {
  CounterfactualSection,
  ImpactPanel,
  InvestigationHeader,
  KeyFactsPanel,
  RootCausePanel,
  SegmentPanel,
  SummaryPanel,
  TimelinePanel,
} from "@/components/investigation/parts";
import { EvidenceGrid } from "@/components/investigation/evidence";
import { SuccessRateChart } from "@/components/charts/charts";
import { getInvestigation } from "@/lib/ai/investigator";
import { narrateInvestigation } from "@/lib/ai/llm";
import { getIncidentStats } from "@/lib/analytics/metrics";
import { formatINR, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const inv = getInvestigation(id);
  return { title: inv ? inv.title : "Investigation" };
}

export default async function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investigation = getInvestigation(id);
  if (!investigation) notFound();

  const narration = await narrateInvestigation(investigation);
  const isUpi = investigation.id === "inv_1042";
  const stats = getIncidentStats();

  const chartProps: React.ComponentProps<typeof SuccessRateChart> = isUpi
    ? {
        data: investigation.successRateSeries,
        baselineLabel: "Learned baseline 97.8%",
        incidentFrom: "14:20",
        incidentTo: "16:20",
        format: "percent0",
      }
    : investigation.id === "inv_1043"
      ? {
          data: investigation.successRateSeries,
          baselineLabel: "Baseline 3.7%",
          format: "percent1",
          invert: true,
        }
      : {
          data: investigation.successRateSeries,
          baselineLabel: "Baseline",
          format: "percent0",
        };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
      <InvestigationHeader investigation={investigation} />

      <div className="mt-6 space-y-4">
        <SummaryPanel summary={narration.text} generatedBy={narration.generatedBy} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Panel>
              <PanelHeader
                title={isUpi ? "Payment success rate" : "Observed metric"}
                meta={
                  isUpi
                    ? `20-minute buckets · trough ${formatPercent(stats.acuteSuccessRate)} in the acute window`
                    : "Against the learned baseline"
                }
              />
              <div className="px-3 py-3">
                <SuccessRateChart {...chartProps} />
              </div>
            </Panel>

            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <EvidenceGrid evidence={investigation.evidence} />
            </Suspense>

            <RootCausePanel investigation={investigation} />
          </div>

          <div className="space-y-4">
            <ImpactPanel investigation={investigation} />
            {isUpi ? (
              <KeyFactsPanel
                items={[
                  { label: "Affected payments", value: stats.affected.toLocaleString("en-IN"), mono: true },
                  { label: "In acute window", value: stats.acuteCount.toLocaleString("en-IN"), mono: true },
                  { label: "Bank X failures", value: stats.segments[0].incidentCount.toLocaleString("en-IN"), mono: true },
                  { label: "High-intent customers", value: String(stats.highIntentCount), mono: true },
                  { label: "Cohort exposure", value: formatINR(stats.highIntentValue) },
                  { label: "Average affected value", value: formatINR(stats.avgAffectedValue) },
                  { label: "Average captured value", value: formatINR(stats.avgCapturedValue) },
                  { label: "Concentration", value: `${stats.concentrationMultiple.toFixed(1)}× baseline` },
                ]}
              />
            ) : null}
            <SegmentPanel investigation={investigation} />
            <TimelinePanel entries={investigation.timeline} />
          </div>
        </div>

        <div className="pt-2">
          <CounterfactualSection investigation={investigation} />
        </div>
      </div>
    </div>
  );
}
