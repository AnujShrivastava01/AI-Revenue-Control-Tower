"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercent, formatShortINR } from "@/lib/utils";

const AXIS = { fontSize: 10, fill: "var(--ink-4)", fontFamily: "var(--font-mono)" };
const GRID = "#eef0f2";

function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-[4px] border border-line bg-surface px-2.5 py-2 shadow-pop">
      <div className="mb-1 font-mono text-[11px] text-ink-4">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline gap-4 text-[12px]">
          <span className="text-ink-3">{r.label}</span>
          <span className="ml-auto font-medium text-ink tnum">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- sparkline */

/** Hand-drawn SVG sparkline — no axes, no chrome, just the shape of a series. */
export function Sparkline({
  values,
  height = 28,
  tone = "neutral",
  baseline,
}: {
  values: number[];
  height?: number;
  tone?: "neutral" | "ok" | "warn" | "danger";
  baseline?: number;
}) {
  if (values.length < 2) return <div style={{ height }} />;
  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const span = max - min || 1;
  const w = 100;
  const y = (v: number) => height - ((v - min) / span) * (height - 4) - 2;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${y(v)}`)
    .join(" ");
  const stroke =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "ok"
          ? "var(--ok)"
          : "var(--ink-3)";

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      {baseline !== undefined ? (
        <line
          x1="0"
          x2={w}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="var(--line-strong)"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------------ revenue area */

export function RevenueChart({
  data,
  height = 168,
}: {
  data: { label: string; revenue: number; refunds: number; atRisk: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatShortINR(v)}
        />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                title={String(label)}
                rows={[
                  { label: "Revenue", value: formatShortINR(Number(payload[0]?.value ?? 0)) },
                  { label: "Refunds", value: formatShortINR(Number(payload[1]?.value ?? 0)) },
                  { label: "At risk", value: formatShortINR(Number(payload[2]?.value ?? 0)) },
                ]}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--ink-2)"
          strokeWidth={1.4}
          fill="#f0f1f3"
          fillOpacity={1}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="refunds"
          stroke="var(--warn)"
          strokeWidth={1.2}
          fill="transparent"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="atRisk"
          stroke="var(--danger)"
          strokeWidth={1.2}
          fill="transparent"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------- hourly volume */

export function HourlyVolumeChart({
  data,
  height = 150,
}: {
  data: { hour: string; captured: number; failed: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barGap={0}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="hour"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval={2}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          cursor={{ fill: "#f4f5f6" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                title={`${label} IST`}
                rows={[
                  { label: "Captured", value: String(payload[0]?.value ?? 0) },
                  { label: "Failed", value: String(payload[1]?.value ?? 0) },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="captured" stackId="a" fill="#d6d9dd" isAnimationActive={false} />
        <Bar dataKey="failed" stackId="a" fill="var(--danger)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------ success rate line */

export function SuccessRateChart({
  data,
  baselineLabel = "Learned baseline",
  height = 196,
  incidentFrom,
  incidentTo,
  format = "percent1",
  invert = false,
}: {
  data: { t: string; rate: number; baseline: number }[];
  baselineLabel?: string;
  height?: number;
  incidentFrom?: string;
  incidentTo?: string;
  /** Formatter key rather than a function — this crosses the server boundary. */
  format?: "percent0" | "percent1";
  invert?: boolean;
}) {
  const baseline = data[0]?.baseline ?? 0;
  const valueFormatter = (v: number) => formatPercent(v, format === "percent0" ? 0 : 1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        {incidentFrom && incidentTo ? (
          <ReferenceArea
            x1={incidentFrom}
            x2={incidentTo}
            fill="var(--danger)"
            fillOpacity={0.05}
            stroke="var(--danger)"
            strokeOpacity={0.18}
          />
        ) : null}
        <XAxis
          dataKey="t"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval="preserveStartEnd"
          minTickGap={34}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={46}
          domain={invert ? [0, "auto"] : [0, 1]}
          tickFormatter={valueFormatter}
        />
        <ReferenceLine
          y={baseline}
          stroke="var(--ink-4)"
          strokeDasharray="3 3"
          strokeWidth={1}
          label={{
            value: baselineLabel,
            position: "insideTopRight",
            fontSize: 10,
            fill: "var(--ink-4)",
          }}
        />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                title={String(label)}
                rows={[
                  { label: "Observed", value: valueFormatter(Number(payload[0]?.value ?? 0)) },
                  { label: baselineLabel, value: valueFormatter(baseline) },
                ]}
              />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="var(--ink)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
