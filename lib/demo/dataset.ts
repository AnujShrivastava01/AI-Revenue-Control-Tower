import { Rng, scaleToTotal, scaleToTotalCapped, calibrateProbabilities } from "./rng";
import * as C from "./config";
import type {
  Chargeback,
  CheckoutSession,
  Customer,
  Invoice,
  Merchant,
  PaymentEvent,
  PaymentMethod,
  Product,
  Refund,
  Settlement,
  Subscription,
  Transaction,
  DeviceType,
} from "@/lib/types";

export interface DailyAggregate {
  day: string; // yyyy-mm-dd
  label: string; // e.g. "Wed 18"
  weekday: number;
  revenue: number;
  transactions: number;
  refunds: number;
  refundValue: number;
  failureRate: number;
  upiMix: number;
  anomalousProductRefundRate: number;
  atRisk: number;
  recovered: number;
  settlementDelayDays: number;
  partial: boolean;
}

export interface Dataset {
  merchant: Merchant;
  customers: Customer[];
  products: Product[];
  transactions: Transaction[];
  refunds: Refund[];
  chargebacks: Chargeback[];
  settlements: Settlement[];
  checkoutSessions: CheckoutSession[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  daily: DailyAggregate[];
  byId: Map<string, Transaction>;
  incident: Transaction[];
  highIntent: Transaction[];
  customerById: Map<string, Customer>;
  productById: Map<string, Product>;
}

const NOW = Date.parse(C.DEMO_NOW);
const DAY0 = Date.parse(C.DAY_START);
const ONSET = Date.parse(C.EVENT_ONSET);
const ACUTE_A = Date.parse(C.ACUTE_START);
const ACUTE_B = Date.parse(C.ACUTE_END);

/** Share of captured attempts that use UPI, tuned so total UPI attempt mix = 61%. */
const CAPTURED_UPI_SHARE = 0.563;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istParts(ms: number) {
  // IST is a fixed +05:30 offset; shifting then reading UTC fields is exact.
  const d = new Date(ms + 5.5 * 3600_000);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
    wd: d.getUTCDay(),
  };
}

export function istDate(ms: number): string {
  const p = istParts(ms);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function istTime(ms: number): string {
  const p = istParts(ms);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function istTimeSeconds(ms: number): string {
  const p = istParts(ms);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}:${String(p.s).padStart(2, "0")}`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Monotone position shaping: pushes samples toward the end of the window. */
function shaped(i: number, n: number, exponent: number): number {
  return Math.pow((i + 0.5) / n, exponent);
}

function pickWeighted<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  return rng.weighted(items, items.map((i) => i.weight));
}

function buildCustomers(rng: Rng): Customer[] {
  const out: Customer[] = [];
  for (let i = 0; i < 3200; i++) {
    const orders = rng.int(1, 24);
    out.push({
      id: `cus_${(i * 7919 + 100000).toString(36).toUpperCase().padStart(6, "0")}`,
      handle: `customer-${String(i + 1).padStart(4, "0")}`,
      firstSeenAt: iso(NOW - rng.int(1, 420) * C.MS.day),
      lifetimeValue: orders * rng.int(180, 1400),
      orders,
    });
  }
  return out;
}

function buildBankPicker(rng: Rng) {
  const weights = C.BANKS.map((b) => b.share);
  return () => rng.weighted(C.BANKS, weights);
}

function methodFor(rng: Rng, upiShare: number): PaymentMethod {
  const rest = 1 - upiShare;
  const base = C.METHOD_MIX.card + C.METHOD_MIX.netbanking + C.METHOD_MIX.wallet;
  return rng.weighted<PaymentMethod>(
    ["upi", "card", "netbanking", "wallet"],
    [
      upiShare,
      (rest * C.METHOD_MIX.card) / base,
      (rest * C.METHOD_MIX.netbanking) / base,
      (rest * C.METHOD_MIX.wallet) / base,
    ],
  );
}

function deviceFor(rng: Rng): DeviceType {
  return rng.weighted<DeviceType>(
    ["android", "ios", "web"],
    [C.DEVICE_MIX.android, C.DEVICE_MIX.ios, C.DEVICE_MIX.web],
  );
}

/**
 * Build today's 10,000 transaction attempts.
 *
 * Slots are laid out chronologically first, then labelled captured /
 * baseline-failure / incident-failure using a deterministic hazard weighting,
 * then priced so that the batch totals land exactly on the scenario targets.
 */
function buildTransactions(rng: Rng, customers: Customer[], products: Product[]): Transaction[] {
  const pickBank = buildBankPicker(rng);

  // --- 1. timestamps -------------------------------------------------------
  const times: number[] = [];
  for (let i = 0; i < C.PRE_EVENT_TRANSACTIONS; i++) {
    // Overnight trough into a morning ramp.
    times.push(DAY0 + shaped(i, C.PRE_EVENT_TRANSACTIONS, 1.75) * (ONSET - DAY0));
  }
  for (let i = 0; i < C.EVENT_TRANSACTIONS; i++) {
    const u = (i + 0.5) / C.EVENT_TRANSACTIONS;
    // Broadly flat business-hours volume with a mid-afternoon peak.
    const p = Math.min(0.9999, Math.max(0, u + 0.06 * Math.sin(2 * Math.PI * u)));
    times.push(ONSET + p * (NOW - ONSET));
  }
  times.sort((a, b) => a - b);

  // --- 2. label the incident cohort ---------------------------------------
  const isIncident = new Array<boolean>(C.TOTAL_TRANSACTIONS).fill(false);
  const isBaselineFail = new Array<boolean>(C.TOTAL_TRANSACTIONS).fill(false);

  const eventStart = C.PRE_EVENT_TRANSACTIONS;
  const hazard: number[] = [];
  for (let i = eventStart; i < C.TOTAL_TRANSACTIONS; i++) {
    const t = times[i];
    let w: number;
    if (t >= ACUTE_A && t <= ACUTE_B) w = 3.2;
    else if (t > ACUTE_B) w = 1.6;
    else w = 0.4 + 0.6 * ((t - ONSET) / (ACUTE_A - ONSET)); // ramp 0.4 → 1.0
    hazard.push(w);
  }
  const hazardTotal = hazard.reduce((a, b) => a + b, 0);
  let cum = 0;
  let assigned = 0;
  for (let k = 0; k < hazard.length; k++) {
    cum += (hazard[k] * C.INCIDENT_FAILURES) / hazardTotal;
    if (assigned < Math.min(C.INCIDENT_FAILURES, Math.floor(cum + 1e-9))) {
      isIncident[eventStart + k] = true;
      assigned++;
    }
  }
  // Absorb any rounding shortfall at the tail of the acute window.
  for (let k = hazard.length - 1; k >= 0 && assigned < C.INCIDENT_FAILURES; k--) {
    if (!isIncident[eventStart + k]) {
      isIncident[eventStart + k] = true;
      assigned++;
    }
  }

  // Ordinary failures: evenly spread across non-incident slots in each window.
  const spread = (from: number, to: number, count: number) => {
    const pool: number[] = [];
    for (let i = from; i < to; i++) if (!isIncident[i]) pool.push(i);
    const stride = pool.length / count;
    for (let n = 0; n < count; n++) isBaselineFail[pool[Math.floor(n * stride)]] = true;
  };
  spread(0, eventStart, C.PRE_EVENT_FAILURES);
  spread(eventStart, C.TOTAL_TRANSACTIONS, C.EVENT_BASELINE_FAILURES);

  // --- 3. segment shares, assigned exactly rather than sampled -------------
  // Bernoulli sampling leaves the headline shares a couple of points away from
  // the scenario; an evenly-strided selection lands them exactly and stays
  // deterministic.
  const incidentSlots: number[] = [];
  const baselineFailSlots: number[] = [];
  for (let i = 0; i < C.TOTAL_TRANSACTIONS; i++) {
    if (isIncident[i]) incidentSlots.push(i);
    else if (isBaselineFail[i]) baselineFailSlots.push(i);
  }
  const strideSet = (slots: number[], count: number) => {
    const set = new Set<number>();
    if (count <= 0) return set;
    for (let k = 0; k < count; k++) set.add(slots[Math.floor((k * slots.length) / count)]);
    return set;
  };
  const incidentBankX = strideSet(
    incidentSlots,
    Math.round(C.INCIDENT_SEGMENT.bankShare * incidentSlots.length),
  );
  const incidentUpi = strideSet(
    incidentSlots,
    Math.round(C.INCIDENT_SEGMENT.upiShare * incidentSlots.length),
  );
  const incidentAndroid = strideSet(
    incidentSlots,
    Math.round(C.INCIDENT_SEGMENT.androidShare * incidentSlots.length),
  );
  const baselineBankX = strideSet(
    baselineFailSlots,
    Math.round(C.BASELINE.bankXFailureShare * baselineFailSlots.length),
  );

  // --- 4. materialise ------------------------------------------------------
  const txns: Transaction[] = [];
  const capturedIdx: number[] = [];
  const incidentIdx: number[] = [];
  const baselineFailIdx: number[] = [];

  for (let i = 0; i < C.TOTAL_TRANSACTIONS; i++) {
    const at = Math.round(times[i]);
    const customer = customers[rng.int(0, customers.length - 1)];
    const product = products[rng.int(0, products.length - 1)];
    const incident = isIncident[i];
    const failed = incident || isBaselineFail[i];

    let method: PaymentMethod;
    let bank = pickBank();
    let device: DeviceType;

    if (incident) {
      method = incidentUpi.has(i)
        ? "upi"
        : rng.weighted<PaymentMethod>(["card", "netbanking"], [0.7, 0.3]);
      bank = incidentBankX.has(i)
        ? C.BANKS[0]
        : rng.weighted(C.BANKS.slice(1), C.BANKS.slice(1).map((b) => b.share));
      device = incidentAndroid.has(i)
        ? "android"
        : rng.weighted<DeviceType>(["ios", "web"], [0.64, 0.36]);
    } else {
      method = methodFor(rng, CAPTURED_UPI_SHARE);
      device = deviceFor(rng);
      if (failed) bank = baselineBankX.has(i) ? C.BANKS[0] : rng.weighted(C.BANKS.slice(1), C.BANKS.slice(1).map((b) => b.share));
    }

    const err = incident
      ? pickWeighted(rng, C.UPI_ERROR_CODES)
      : failed
        ? pickWeighted(rng, C.GENERIC_ERROR_CODES)
        : null;

    const txn: Transaction = {
      id: "", // assigned below
      merchantId: C.MERCHANT.id,
      customerId: customer.id,
      productId: product.id,
      amount: 0, // priced below
      currency: "INR",
      method,
      bank: bank.code,
      device,
      status: failed ? "failed" : "captured",
      createdAt: iso(at),
      rrn: String(rng.int(100000000000, 999999999999)),
    };
    if (method === "upi") txn.vpa = `${customer.handle}@${bank.code.toLowerCase()}`;
    if (err) {
      txn.errorCode = err.code;
      txn.errorReason = err.reason;
    }
    if (incident) txn.anomalyId = "anm_upi_degradation";

    txns.push(txn);
    if (incident) incidentIdx.push(i);
    else if (failed) baselineFailIdx.push(i);
    else capturedIdx.push(i);
  }

  // --- 4. identifiers ------------------------------------------------------
  const ids: string[] = [];
  for (let n = 0; n < C.TOTAL_TRANSACTIONS; n++) ids.push(`TXN_${80000 + n}`);
  for (let n = ids.length - 1; n > 0; n--) {
    const j = rng.int(0, n);
    [ids[n], ids[j]] = [ids[j], ids[n]];
  }
  txns.forEach((t, i) => (t.id = ids[i]));

  // --- 5. planted evidence + high-intent cohort -----------------------------
  const acuteSet = new Set(incidentIdx.filter((i) => times[i] >= ACUTE_A && times[i] <= ACUTE_B));
  const orderedIncident = [
    ...incidentIdx.filter((i) => acuteSet.has(i)),
    ...incidentIdx.filter((i) => !acuteSet.has(i)),
  ];

  // The six narration-stable evidence transactions. These are the largest
  // failures in the incident and therefore sit *above* the per-customer policy
  // ceiling, which is why the bounded action is not allowed to touch them.
  const idOwner = new Map<string, number>();
  txns.forEach((t, i) => idOwner.set(t.id, i));
  const plantedIdx: number[] = [];
  C.PLANTED_EVIDENCE.forEach((plant, n) => {
    const target = orderedIncident[n];
    const currentHolder = idOwner.get(plant.id);
    if (currentHolder !== undefined && currentHolder !== target) {
      const swapped = txns[target].id;
      txns[currentHolder].id = swapped;
      idOwner.set(swapped, currentHolder);
      txns[target].id = plant.id;
      idOwner.set(plant.id, target);
    }
    txns[target].amount = plant.amount;
    txns[target].createdAt = iso(ACUTE_A + plant.minuteOffset * C.MS.minute);
    txns[target].method = "upi";
    txns[target].bank = C.BANKS[0].code;
    txns[target].device = "android";
    plantedIdx.push(target);
  });
  const plantedSet = new Set(plantedIdx);

  // One failed attempt per customer, acute window first, evidence excluded.
  const seenCustomers = new Set<string>();
  const highIntentIdx: number[] = [];
  for (const i of orderedIncident) {
    if (highIntentIdx.length >= C.HIGH_INTENT_CUSTOMERS) break;
    if (plantedSet.has(i)) continue;
    if (seenCustomers.has(txns[i].customerId)) continue;
    seenCustomers.add(txns[i].customerId);
    highIntentIdx.push(i);
  }
  const highIntentSet = new Set(highIntentIdx);
  highIntentIdx.forEach((idx) => (txns[idx].highIntent = true));

  // --- 6. pricing ----------------------------------------------------------
  const capturedRaw = capturedIdx.map(() => rng.basket(0.028, 1500, 12000));
  const capturedAmounts = scaleToTotal(capturedRaw, C.CAPTURED_VALUE_TODAY);
  capturedIdx.forEach((idx, n) => (txns[idx].amount = capturedAmounts[n]));

  // Every high-intent payment is priced below the per-customer ceiling, so the
  // cohort the decision engine proposes is executable without exception.
  const hiRaw = highIntentIdx.map(() => rng.basket(0.14, 1200, 4600));
  const hiAmounts = scaleToTotalCapped(hiRaw, C.HIGH_INTENT_VALUE, C.POLICY_CEILING_PER_CUSTOMER - 100);
  highIntentIdx.forEach((idx, n) => (txns[idx].amount = hiAmounts[n]));

  const plantedTotal = C.PLANTED_EVIDENCE.reduce((a, b) => a + b.amount, 0);
  const restIncident = incidentIdx.filter((i) => !highIntentSet.has(i) && !plantedSet.has(i));
  const restRaw = restIncident.map(() => rng.basket(0.02, 900, 5200));
  const restAmounts = scaleToTotal(
    restRaw,
    C.INCIDENT_VALUE - C.HIGH_INTENT_VALUE - plantedTotal,
  );
  restIncident.forEach((idx, n) => (txns[idx].amount = restAmounts[n]));

  baselineFailIdx.forEach((idx) => (txns[idx].amount = rng.basket(0.02, 900, 4000)));

  // --- 7. recovery model ---------------------------------------------------
  const hiAll = highIntentIdx.map((i) => txns[i].amount);
  const hiProbRaw = highIntentIdx.map(() => rng.float(0.44, 0.93));
  const hiProb = calibrateProbabilities(hiAll, hiProbRaw, C.RECOVERY_MEAN_HIGH_INTENT);
  highIntentIdx.forEach((idx, n) => (txns[idx].recoveryProbability = hiProb[n]));

  const others = [...restIncident, ...plantedIdx];
  const otherAmounts = others.map((i) => txns[i].amount);
  const otherTargetMean =
    (C.ANOMALY_LEDGER.upi_degradation.recoverable - 126_000) /
    (C.INCIDENT_VALUE - C.HIGH_INTENT_VALUE);
  const otherProbRaw = others.map(() => rng.float(0.26, 0.9));
  const otherProb = calibrateProbabilities(otherAmounts, otherProbRaw, otherTargetMean);
  others.forEach((idx, n) => (txns[idx].recoveryProbability = otherProb[n]));

  baselineFailIdx.forEach((idx) => (txns[idx].recoveryProbability = rng.float(0.08, 0.34)));

  return txns;
}

function buildRefunds(rng: Rng, txns: Transaction[]): Refund[] {
  const out: Refund[] = [];
  const reasons = [
    "Item not as described",
    "Damaged on arrival",
    "Delivery delay",
    "Customer changed mind",
    "Duplicate order",
  ];
  // Refund counts are struck exactly rather than sampled, so the observed rate
  // on the anomalous SKU is the rate the investigation quotes.
  const captured = txns.filter((t) => t.status === "captured");
  const chosen = new Set<string>();
  const strike = (pool: typeof captured, rate: number) => {
    const count = Math.round(pool.length * rate);
    for (let k = 0; k < count; k++) chosen.add(pool[Math.floor((k * pool.length) / count)].id);
  };
  strike(captured.filter((t) => t.productId === C.ANOMALOUS_PRODUCT_ID), 0.089);
  strike(captured.filter((t) => t.productId !== C.ANOMALOUS_PRODUCT_ID), 0.032);

  for (const t of captured) {
    if (!chosen.has(t.id)) continue;
    const anomalous = t.productId === C.ANOMALOUS_PRODUCT_ID;
    const at = Date.parse(t.createdAt) + rng.int(20, 300) * C.MS.minute;
    out.push({
      id: `rfnd_${String(out.length + 41200).padStart(6, "0")}`,
      transactionId: t.id,
      productId: t.productId,
      amount: t.amount,
      reason: anomalous
        ? rng.weighted(["Item not as described", "Damaged on arrival", "Customer changed mind"], [0.55, 0.3, 0.15])
        : rng.pick(reasons),
      createdAt: iso(Math.min(at, NOW)),
      status: rng.bool(0.86) ? "processed" : "pending",
    });
  }
  return out;
}

function buildChargebacks(rng: Rng, txns: Transaction[]): Chargeback[] {
  const captured = txns.filter((t) => t.status === "captured" && t.amount > 1200);
  const picked: Chargeback[] = [];
  const raw: number[] = [];
  const codes = ["4853 — Cardholder dispute", "4837 — No cardholder authorisation", "13.1 — Merchandise not received"];
  for (let i = 0; i < 9; i++) {
    const t = captured[Math.floor((i / 9) * captured.length)];
    raw.push(rng.int(2000, 14000));
    picked.push({
      id: `cbk_${String(9100 + i)}`,
      transactionId: t.id,
      amount: 0,
      reasonCode: rng.pick(codes),
      createdAt: iso(NOW - rng.int(1, 12) * C.MS.day),
      status: rng.weighted<Chargeback["status"]>(["open", "represented", "lost"], [0.66, 0.22, 0.12]),
    });
  }
  const amounts = scaleToTotal(raw, C.ANOMALY_LEDGER.chargeback_exposure.impact);
  picked.forEach((c, i) => (c.amount = amounts[i]));
  return picked;
}

function buildSettlements(rng: Rng, daily: DailyAggregate[]): Settlement[] {
  const out: Settlement[] = [];
  const recent = daily.slice(-15, -1);
  recent.forEach((d, i) => {
    // Expected: the published T+1.3 SLA. Actual: 0.1 days slower in the last week.
    const expected = Date.parse(`${d.day}T20:00:00+05:30`) + Math.round(C.BASELINE.settlementDays * C.MS.day);
    const slippage = i >= recent.length - 7 ? 0.1 * C.MS.day : 0;
    const discrepancy = i === recent.length - 4;
    const fees = Math.round(d.revenue * 0.0203);
    const tax = Math.round(fees * 0.18);
    out.push({
      id: `setl_${String(3300 + i)}`,
      utr: `UTR${rng.int(1000000000, 9999999999)}`,
      amount: d.revenue - fees - tax - (discrepancy ? C.ANOMALY_LEDGER.settlement_discrepancy.impact : 0),
      fees,
      tax,
      expectedAt: iso(expected),
      settledAt: iso(expected + slippage + rng.int(-12, 12) * C.MS.minute),
      status: discrepancy ? "discrepancy" : "settled",
      varianceAmount: discrepancy ? -C.ANOMALY_LEDGER.settlement_discrepancy.impact : 0,
      transactionCount: d.transactions,
    });
  });
  return out.reverse();
}

function buildCheckoutSessions(rng: Rng, customers: Customer[], products: Product[]): CheckoutSession[] {
  const out: CheckoutSession[] = [];
  const abandonedRaw: number[] = [];
  const abandonedIdx: number[] = [];
  const stages: CheckoutSession["stage"][] = ["cart", "contact", "method_select", "auth"];
  const reasons = [
    "Left at UPI collect step",
    "Payment method list did not load",
    "Abandoned after failed attempt",
    "Session timed out at authentication",
  ];
  for (let i = 0; i < 742; i++) {
    const completed = i >= 61;
    const at = DAY0 + Math.round(shaped(i % 742, 742, 1.1) * (NOW - DAY0));
    const cust = customers[rng.int(0, customers.length - 1)];
    const prod = products[rng.int(0, products.length - 1)];
    const s: CheckoutSession = {
      id: `chk_${String(70200 + i)}`,
      customerId: cust.id,
      productId: prod.id,
      amount: completed ? rng.basket(0.03, 1500, 9000) : 0,
      createdAt: iso(at),
      stage: completed ? "completed" : rng.weighted(stages, [0.12, 0.14, 0.38, 0.36]),
      completed,
    };
    if (!completed) {
      s.dropOffReason = rng.pick(reasons);
      abandonedRaw.push(rng.int(400, 4200));
      abandonedIdx.push(out.length);
    }
    out.push(s);
  }
  const amounts = scaleToTotal(abandonedRaw, C.ANOMALY_LEDGER.checkout_drop.impact);
  abandonedIdx.forEach((idx, n) => (out[idx].amount = amounts[n]));
  return out;
}

function buildSubscriptions(rng: Rng, customers: Customer[]): Subscription[] {
  const plans = [
    { name: "Replenish Monthly", amount: 499, interval: "monthly" as const },
    { name: "Care Plus", amount: 899, interval: "monthly" as const },
    { name: "Quarterly Saver", amount: 2399, interval: "quarterly" as const },
  ];
  const out: Subscription[] = [];
  for (let i = 0; i < 240; i++) {
    const plan = rng.pick(plans);
    const status = rng.weighted<Subscription["status"]>(["active", "halted", "cancelled"], [0.83, 0.11, 0.06]);
    out.push({
      id: `sub_${String(5100 + i)}`,
      customerId: customers[rng.int(0, customers.length - 1)].id,
      planName: plan.name,
      amount: plan.amount,
      interval: plan.interval,
      status,
      nextChargeAt: iso(NOW + rng.int(1, 30) * C.MS.day),
      failedCharges: status === "halted" ? rng.int(2, 4) : rng.int(0, 1),
    });
  }
  return out;
}

function buildInvoices(rng: Rng, customers: Customer[]): Invoice[] {
  const out: Invoice[] = [];
  const overdueRaw: number[] = [];
  const overdueIdx: number[] = [];
  for (let i = 0; i < 118; i++) {
    const overdue = i < 27;
    const issued = NOW - rng.int(overdue ? 34 : 6, overdue ? 96 : 40) * C.MS.day;
    const due = issued + 30 * C.MS.day;
    const inv: Invoice = {
      id: `inv_${String(8800 + i)}`,
      customerId: customers[rng.int(0, customers.length - 1)].id,
      amount: overdue ? 0 : rng.int(1200, 26000),
      issuedAt: iso(issued),
      dueAt: iso(due),
      status: overdue ? "overdue" : rng.bool(0.86) ? "paid" : "issued",
      daysOverdue: overdue ? Math.max(1, Math.round((NOW - due) / C.MS.day)) : 0,
    };
    if (overdue) {
      overdueRaw.push(rng.int(900, 9000));
      overdueIdx.push(out.length);
    }
    out.push(inv);
  }
  const amounts = scaleToTotal(overdueRaw, C.ANOMALY_LEDGER.receivables.impact);
  overdueIdx.forEach((idx, n) => (out[idx].amount = amounts[n]));
  return out;
}

/** 42 days of learned history. Today is appended as a partial day. */
function buildDaily(rng: Rng): DailyAggregate[] {
  const out: DailyAggregate[] = [];
  const weekdayFactor = [0.32, 1.0, 1.02, 1.0, 1.04, 1.06, 0.56]; // Sun … Sat
  for (let back = C.BATCH_TOTALS.historyDays - 1; back >= 0; back--) {
    const ms = DAY0 - back * C.MS.day;
    const p = istParts(ms);
    const isToday = back === 0;
    const trend = 1 + (C.BATCH_TOTALS.historyDays - back) * 0.0016;
    const base = 2_560_000 * weekdayFactor[p.wd] * trend * rng.float(0.96, 1.04);
    let revenue = Math.round(base);
    if (p.wd === 0 && back <= 6) revenue = 820_000; // most recent Sunday
    if (isToday) revenue = C.CAPTURED_VALUE_TODAY; // partial day, to 16:45
    const spike = back <= 8;
    const transactions = isToday
      ? C.TOTAL_TRANSACTIONS -
        C.PRE_EVENT_FAILURES -
        C.EVENT_BASELINE_FAILURES -
        C.INCIDENT_FAILURES
      : Math.round(revenue / rng.float(196, 232));
    const refundRate = spike ? rng.float(0.048, 0.056) : rng.float(0.031, 0.036);
    out.push({
      day: istDate(ms),
      label: `${WEEKDAY_LABELS[p.wd]} ${String(p.d).padStart(2, "0")}`,
      weekday: p.wd,
      revenue,
      transactions,
      refunds: Math.round(transactions * refundRate),
      refundValue: Math.round(revenue * refundRate),
      failureRate: isToday ? 0.1467 : rng.float(0.018, 0.024),
      upiMix: isToday ? 0.61 : rng.float(0.605, 0.634),
      anomalousProductRefundRate: spike ? rng.float(0.081, 0.094) : rng.float(0.033, 0.041),
      atRisk: isToday ? C.ANOMALY_LEDGER.upi_degradation.impact : Math.round(revenue * rng.float(0.004, 0.011)),
      recovered: Math.round(revenue * rng.float(0.002, 0.006)),
      settlementDelayDays: back <= 6 ? 1.4 : rng.float(1.24, 1.36),
      partial: isToday,
    });
  }
  return out;
}

function generate(): Dataset {
  const rng = new Rng(C.DEMO_SEED);
  const merchant: Merchant = { ...C.MERCHANT };
  const products: Product[] = C.PRODUCTS.map((p) => ({ ...p }));
  const customers = buildCustomers(rng);
  const transactions = buildTransactions(rng, customers, products);
  const daily = buildDaily(rng);
  const refunds = buildRefunds(rng, transactions);
  const chargebacks = buildChargebacks(rng, transactions);
  const settlements = buildSettlements(rng, daily);
  const checkoutSessions = buildCheckoutSessions(rng, customers, products);
  const subscriptions = buildSubscriptions(rng, customers);
  const invoices = buildInvoices(rng, customers);

  const byId = new Map(transactions.map((t) => [t.id, t]));
  const incident = transactions.filter((t) => t.anomalyId === "anm_upi_degradation");
  const highIntent = incident.filter((t) => t.highIntent);

  return {
    merchant,
    customers,
    products,
    transactions,
    refunds,
    chargebacks,
    settlements,
    checkoutSessions,
    subscriptions,
    invoices,
    daily,
    byId,
    incident,
    highIntent,
    customerById: new Map(customers.map((c) => [c.id, c])),
    productById: new Map(products.map((p) => [p.id, p])),
  };
}

const cacheKey = Symbol.for("fct.dataset.v1");
type CacheHost = Record<symbol, Dataset | undefined>;

/** Built once per server process; identical output on every process. */
export function getDataset(): Dataset {
  const host = globalThis as unknown as CacheHost;
  if (!host[cacheKey]) host[cacheKey] = generate();
  return host[cacheKey] as Dataset;
}

/** Payment lifecycle events, derived on demand for the transaction drawer. */
export function buildPaymentEvents(txn: Transaction): PaymentEvent[] {
  const t0 = Date.parse(txn.createdAt);
  const seed = [...txn.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = new Rng(C.DEMO_SEED + seed);
  const events: PaymentEvent[] = [
    {
      id: `evt_${txn.id}_1`,
      transactionId: txn.id,
      at: iso(t0),
      type: "created",
      detail: `Order created · ${txn.method.toUpperCase()} · ${txn.device}`,
    },
  ];
  if (txn.status === "captured") {
    events.push({
      id: `evt_${txn.id}_2`,
      transactionId: txn.id,
      at: iso(t0 + rng.int(2, 9) * 1000),
      type: "authorized",
      detail: `Authorised by ${txn.bank}`,
    });
    events.push({
      id: `evt_${txn.id}_3`,
      transactionId: txn.id,
      at: iso(t0 + rng.int(10, 24) * 1000),
      type: "captured",
      detail: "Captured to merchant balance",
    });
  } else {
    events.push({
      id: `evt_${txn.id}_2`,
      transactionId: txn.id,
      at: iso(t0 + rng.int(20, 31) * 1000),
      type: "failed",
      gatewayCode: txn.errorCode,
      detail: txn.errorReason ?? "Payment failed",
    });
    if (txn.anomalyId) {
      events.push({
        id: `evt_${txn.id}_3`,
        transactionId: txn.id,
        at: iso(t0 + rng.int(45, 70) * 1000),
        type: "retried",
        gatewayCode: txn.errorCode,
        detail: `Automatic retry 1 of ${2} failed at ${txn.bank}`,
      });
    }
  }
  return events;
}

export { NOW as DEMO_NOW_MS, DAY0 as DAY_START_MS, ONSET as ONSET_MS, ACUTE_A as ACUTE_START_MS, ACUTE_B as ACUTE_END_MS };
