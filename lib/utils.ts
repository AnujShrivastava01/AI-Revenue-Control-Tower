import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,84,200 — full precision, Indian digit grouping. */
export function formatINR(value: number): string {
  return `₹${inr.format(Math.round(value))}`;
}

export function formatNumber(value: number): string {
  return inr.format(Math.round(value));
}

/**
 * Compact Indian money scale: ₹4.82L / ₹1.24Cr / ₹8,400.
 * Used wherever a figure competes for attention with other figures.
 */
export function formatShortINR(value: number): string {
  const v = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (v >= 1_00_00_000) return `${sign}₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000) return `${sign}₹${(v / 1_00_000).toFixed(2)}L`;
  if (v >= 1_000) return `${sign}₹${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return `${sign}₹${inr.format(Math.round(v))}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const s = (value * 100).toFixed(digits);
  return `${value >= 0 ? "+" : ""}${s}%`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(1)}×`;
}

/** HH:MM in IST for a stored ISO timestamp. */
export function timeIST(isoString: string): string {
  const d = new Date(Date.parse(isoString) + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function timeISTSeconds(isoString: string): string {
  const d = new Date(Date.parse(isoString) + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(
    d.getUTCSeconds(),
  ).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateIST(isoString: string): string {
  const d = new Date(Date.parse(isoString) + 5.5 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dateTimeIST(isoString: string): string {
  return `${dateIST(isoString)} · ${timeIST(isoString)} IST`;
}

export function titleCase(s: string): string {
  return s.replace(/(^|[\s_-])(\w)/g, (_, a, b) => `${a === "_" || a === "-" ? " " : a}${b.toUpperCase()}`);
}
