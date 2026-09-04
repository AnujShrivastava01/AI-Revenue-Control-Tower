/**
 * Deterministic pseudo-random number generation.
 *
 * Every number in the demo dataset traces back to a fixed seed, so the same
 * build always produces the same transactions, anomalies and totals. Nothing in
 * the product uses Math.random().
 */

export class Rng {
  private state: number;

  constructor(seed: number) {
    // mulberry32
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  bool(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Pick from `items` using parallel `weights`. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Box–Muller normal sample. */
  normal(mean: number, sd: number): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Heavy-tailed order value: mostly small basket sizes with a thin large tail. */
  basket(tailProbability: number, tailMin: number, tailMax: number): number {
    if (this.bool(tailProbability)) return Math.round(this.float(tailMin, tailMax));
    const u = this.next();
    return Math.round(60 + u * u * 640);
  }
}

/**
 * Rescale a list of raw amounts so it sums to exactly `target` rupees.
 * The residual from integer rounding is absorbed by the largest element, which
 * keeps every headline total exact without distorting the distribution.
 */
export function scaleToTotal(raw: number[], target: number): number[] {
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum === 0) return raw.map(() => 0);
  const factor = target / sum;
  const scaled = raw.map((v) => Math.max(1, Math.round(v * factor)));
  const diff = target - scaled.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < scaled.length; i++) if (scaled[i] > scaled[maxIdx]) maxIdx = i;
    scaled[maxIdx] = Math.max(1, scaled[maxIdx] + diff);
  }
  return scaled;
}

/**
 * As `scaleToTotal`, but with a hard per-item ceiling. Used for cohorts a
 * bounded action is allowed to target, where the policy engine's per-customer
 * ceiling must hold for every member by construction.
 */
export function scaleToTotalCapped(raw: number[], target: number, cap: number): number[] {
  if (raw.length * cap < target) throw new Error("scaleToTotalCapped: target exceeds cap capacity");
  let values = scaleToTotal(raw, target).map((v) => Math.min(v, cap));
  for (let pass = 0; pass < 12; pass++) {
    const deficit = target - values.reduce((a, b) => a + b, 0);
    if (deficit === 0) break;
    const headroom = values.map((v) => cap - v);
    const totalHeadroom = headroom.reduce((a, b) => a + b, 0);
    if (totalHeadroom <= 0) break;
    values = values.map((v, i) =>
      Math.min(cap, Math.max(1, Math.round(v + (deficit * headroom[i]) / totalHeadroom))),
    );
  }
  // Absorb the final rounding residual on an item that still has headroom.
  let residual = target - values.reduce((a, b) => a + b, 0);
  for (let i = 0; i < values.length && residual !== 0; i++) {
    const room = residual > 0 ? cap - values[i] : values[i] - 1;
    const step = Math.sign(residual) * Math.min(Math.abs(residual), room);
    values[i] += step;
    residual -= step;
  }
  return values;
}

/**
 * Normalise per-item probabilities so that the amount-weighted mean equals
 * `targetMean`. Used by the recovery model so "estimated recoverable" is a real
 * weighted expectation over the cohort rather than a hard-coded figure.
 */
export function calibrateProbabilities(
  amounts: number[],
  raw: number[],
  targetMean: number,
): number[] {
  const value = amounts.reduce((a, b) => a + b, 0);
  if (value === 0) return raw;
  let probs = raw.slice();
  // Alternating rescale/clamp converges quickly; six passes is far more than
  // enough to land the weighted mean inside display precision.
  for (let pass = 0; pass < 6; pass++) {
    const weighted = amounts.reduce((acc, amt, i) => acc + amt * probs[i], 0);
    if (weighted === 0) break;
    const factor = (targetMean * value) / weighted;
    probs = probs.map((p) => Math.min(0.97, Math.max(0.02, p * factor)));
  }
  return probs;
}
