import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ panels */

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md border border-line bg-surface shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-line px-4 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="eyebrow">{title}</h2>
        {meta ? <span className="truncate text-xxs text-ink-4 tnum">{meta}</span> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-line-strong bg-raised text-ink-3",
  ok: "border-ok/25 bg-ok-soft text-ok",
  warn: "border-warn/25 bg-warn-soft text-warn",
  danger: "border-danger/25 bg-danger-soft text-danger",
  accent: "border-accent/25 bg-accent-soft text-accent",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === "ok"
      ? "bg-ok"
      : tone === "warn"
        ? "bg-warn"
        : tone === "danger"
          ? "bg-danger"
          : tone === "accent"
            ? "bg-accent"
            : "bg-ink-4";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        color,
        pulse && "animate-pulse-dot",
        className,
      )}
    />
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-[4px] border text-[13px] font-medium leading-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[#101216] text-white hover:bg-[#23272e] active:bg-[#0b0d10]",
  secondary:
    "border-line-strong bg-surface text-ink hover:bg-raised active:bg-[#f1f2f4]",
  ghost: "border-transparent bg-transparent text-ink-3 hover:bg-raised hover:text-ink",
  danger: "border-danger/30 bg-surface text-danger hover:bg-danger-soft",
};

const BUTTON_SIZE = {
  sm: "h-7 px-2.5",
  md: "h-8 px-3",
  lg: "h-9 px-4 text-[13.5px]",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
}) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
}) {
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------- data bits */

export function Metric({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ok" | "warn" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="eyebrow mb-1.5">{label}</div>
      <div
        className={cn(
          "text-[19px] font-semibold leading-none tracking-[-0.015em] tnum",
          tone === "danger" && "text-danger",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xxs text-ink-3 tnum">{sub}</div> : null}
    </div>
  );
}

export function KeyValue({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode; mono?: boolean }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const cols = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3", cols, className)}>
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="min-w-0">
          <dt className="eyebrow mb-1">{item.label}</dt>
          <dd
            className={cn(
              "truncate text-[13px] text-ink",
              item.mono && "font-mono text-[12px] tracking-tight",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[12px] tracking-tight text-ink-2", className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ states */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-sm", className)} />;
}

export function EmptyState({
  title,
  detail,
  action,
  icon,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-ink-4">{icon}</div> : null}
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-3">{detail}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- comparison */

/** Two-bar comparison used wherever an observed share is set against a baseline. */
export function ShareComparison({
  label,
  observed,
  baseline,
  observedLabel = "Incident",
  baselineLabel = "Baseline",
  tone = "danger",
}: {
  label: string;
  observed: number;
  baseline: number;
  observedLabel?: string;
  baselineLabel?: string;
  tone?: "danger" | "warn" | "accent";
}) {
  const barColor =
    tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-accent";
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-xxs text-ink-3 tnum">
          {pct(baseline)} → <span className="font-semibold text-ink">{pct(observed)}</span>
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wider text-ink-4">
            {baselineLabel}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-[#eef0f2]">
            <div
              className="h-full origin-left bg-ink-4 animate-grow-x"
              style={{ width: `${Math.max(1, baseline * 100)}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-xxs text-ink-3 tnum">{pct(baseline)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wider text-ink-4">
            {observedLabel}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-[#eef0f2]">
            <div
              className={cn("h-full origin-left animate-grow-x", barColor)}
              style={{ width: `${Math.max(1, observed * 100)}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-xxs font-semibold text-ink tnum">
            {pct(observed)}
          </span>
        </div>
      </div>
    </div>
  );
}
