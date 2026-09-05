/**
 * Canonical constants for the seeded demo environment.
 *
 * The dataset is *constructed* to these targets rather than sampled and hoped
 * over, so a presenter gets identical numbers on every run and every machine.
 * Each constant below is either (a) a scenario target the generator must hit
 * exactly, or (b) a model coefficient used by the analytics/decision layer.
 *
 * All amounts are whole rupees.
 */

export const DEMO_SEED = 20260218;

/** Fixed clock. The product never reads wall-clock time for demo data. */
export const DEMO_NOW = "2026-02-18T16:45:00+05:30";
export const DAY_START = "2026-02-18T00:00:00+05:30";

/** Incident onset (degradation becomes measurable). */
export const EVENT_ONSET = "2026-02-18T09:12:00+05:30";
/** Acute window quoted in the investigation summary. */
export const ACUTE_START = "2026-02-18T14:30:00+05:30";
export const ACUTE_END = "2026-02-18T16:10:00+05:30";

export const MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

// ---------------------------------------------------------------------------
// Batch shape. Chosen so that the derived rates below come out exact.
// ---------------------------------------------------------------------------

export const TOTAL_TRANSACTIONS = 10_000;

/** 00:00 → 09:12. Clean period that establishes today's pre-incident baseline. */
export const PRE_EVENT_TRANSACTIONS = 2_382;
export const PRE_EVENT_FAILURES = 52; // → 97.8% success

/** 09:12 → 16:45. Degradation period. */
export const EVENT_TRANSACTIONS = TOTAL_TRANSACTIONS - PRE_EVENT_TRANSACTIONS; // 7,618
/** Failures attributed to the UPI degradation signature. */
export const INCIDENT_FAILURES = 1_284;
/** Ordinary failures that would have happened anyway (2.1% learned baseline). */
export const EVENT_BASELINE_FAILURES = 131; // → 81.4% success during the event

/** Captured value today. Generator scales captured amounts to hit this exactly. */
export const CAPTURED_VALUE_TODAY = 1_842_000; // ₹18.42L
/** Day-over-day comparison against the merchant's learned Wednesday curve. */
export const PROCESSED_DELTA = 0.068; // +6.8%

/** Value of the transactions attributed to the incident. */
export const INCIDENT_VALUE = 482_000; // ₹4.82L

/**
 * High-intent cohort: one failed attempt per customer, strongest repeat-purchase
 * signal. This is the cohort a bounded recovery action is allowed to target.
 */
export const HIGH_INTENT_CUSTOMERS = 184;
export const HIGH_INTENT_VALUE = 192_000; // ₹1.92L of the ₹4.82L

/**
 * Mirrors POLICY_LIMITS.MAX_AUTO_ACTION_AMOUNT. The generator prices the
 * high-intent cohort under this ceiling so the proposed action is executable
 * in full, while the six largest failures sit above it and are held back for
 * manual approval — a visible demonstration of the ceiling doing work.
 */
export const POLICY_CEILING_PER_CUSTOMER = 5_000;

/** Recovery model — amount-weighted probability that a failed payment converts. */
export const RECOVERY_MEAN_ALL = 314_000 / INCIDENT_VALUE; // 0.6515
export const RECOVERY_MEAN_HIGH_INTENT = 126_000 / HIGH_INTENT_VALUE; // 0.65625
/** Uplift applied when the customer is offered a working alternate rail. */
export const ALTERNATE_METHOD_UPLIFT = 0.74 / RECOVERY_MEAN_HIGH_INTENT; // 1.128×

// ---------------------------------------------------------------------------
// Counterfactual coefficients (documented in docs/report.tex §6)
// ---------------------------------------------------------------------------

/** Share of at-risk value that churns permanently with no intervention. */
export const DO_NOTHING_LOSS_RATE = 210_000 / INCIDENT_VALUE; // 0.4357
export const DO_NOTHING_PROBABILITY = 0.78;

/** Blind retry converts a smaller share because the rail is still degraded. */
export const RETRY_RECOVERY_RATE = 170_000 / INCIDENT_VALUE; // 0.3527
export const RETRY_COST_PER_ATTEMPT = 4.67; // gateway + messaging, per attempt
export const RETRY_ATTEMPTS_PER_TXN = 2;

/** Offering a working rail converts more, but costs an outbound contact. */
export const ALTERNATE_RECOVERY_RATE = 240_000 / INCIDENT_VALUE; // 0.4979
export const ALTERNATE_COST_PER_CUSTOMER = 21.8;

// ---------------------------------------------------------------------------
// Segment mixes
// ---------------------------------------------------------------------------

export const METHOD_MIX = { upi: 0.61, card: 0.24, netbanking: 0.09, wallet: 0.06 } as const;
export const DEVICE_MIX = { android: 0.58, ios: 0.27, web: 0.15 } as const;

export const BANKS = [
  { code: "BANKX", name: "Bank X", share: 0.21 },
  { code: "KSTL", name: "Kestrel Bank", share: 0.22 },
  { code: "MRDN", name: "Meridian Bank", share: 0.19 },
  { code: "NRTG", name: "Northgate Bank", share: 0.16 },
  { code: "SNTL", name: "Sentinel Bank", share: 0.13 },
  { code: "HRBR", name: "Harbour Bank", share: 0.09 },
] as const;

/** Concentration of the incident inside the affected segment. */
export const INCIDENT_SEGMENT = {
  bankShare: 0.87, // vs 0.21 baseline → 4.1× concentration
  upiShare: 0.92,
  androidShare: 0.88,
  /** Share of incident failures falling inside the 14:30–16:10 acute window. */
  acuteShare: 0.55,
} as const;

export const BASELINE = {
  successRate: 0.978,
  failureRate: 0.021,
  upiMix: 0.62,
  refundRate: 0.037,
  settlementDays: 1.3,
  /** Bank X's ordinary share of this merchant's failures — the 4.1× denominator. */
  bankXFailureShare: 0.213,
  sundayRevenueLow: 700_000,
  sundayRevenueHigh: 900_000,
} as const;

// ---------------------------------------------------------------------------
// Anomaly impact ledger. The command-centre risk rollup is the sum of these.
// ---------------------------------------------------------------------------

export const ANOMALY_LEDGER = {
  upi_degradation: { impact: 482_000, recoverable: 314_000 },
  refund_spike: { impact: 110_000, recoverable: 66_000 },
  receivables: { impact: 82_000, recoverable: 41_000 },
  checkout_drop: { impact: 72_000, recoverable: 43_000 },
  chargeback_exposure: { impact: 58_000, recoverable: 15_000 },
  settlement_discrepancy: { impact: 38_000, recoverable: 38_000 },
  card_testing: { impact: 195_000, recoverable: 195_000 },
  duplicate_charge: { impact: 86_000, recoverable: 86_000 },
} as const;
// Σ impact = ₹11.23L · Σ recoverable = ₹7.98L

/**
 * Card-testing fraud burst — a bot validating stolen card numbers in a short,
 * high-velocity window. Every figure below is a fixed narrative constant, the
 * same design as PLANTED_EVIDENCE: stable numbers for a stable demo.
 */
export const CARD_TESTING = {
  windowStart: "2026-02-18T12:47:00+05:30",
  windowEnd: "2026-02-18T13:05:00+05:30",
  attempts: 214,
  newProfiles: 189,
  declined: 205,
  authorized: 9,
  largestAuthorized: 58,
  avgAttemptedAmount: 42,
  normalCardAvgAmount: 216,
  declineRate: 0.96,
  baselineDeclineRate: 0.024,
} as const;

/**
 * Duplicate-charge incident — a checkout retry re-submitted a payment after a
 * gateway timeout without an idempotency check, capturing the same order twice.
 */
export const DUPLICATE_CHARGE = {
  windowStart: "2026-02-18T11:10:00+05:30",
  windowEnd: "2026-02-18T11:40:00+05:30",
  pairs: 42,
  medianGapSeconds: 61,
  examples: [
    { order: "ORD-88213", amount: 1_299, firstAt: "2026-02-18T11:12:04+05:30", gapSeconds: 61 },
    { order: "ORD-88240", amount: 2_150, firstAt: "2026-02-18T11:19:22+05:30", gapSeconds: 47 },
    { order: "ORD-88266", amount: 899, firstAt: "2026-02-18T11:27:51+05:30", gapSeconds: 74 },
  ],
} as const;

/** Cumulative outcomes across the 42-day synthetic history. */
export const BATCH_TOTALS = {
  anomaliesDetected: 37,
  investigations: 29,
  recovered: 384_000,
  actionsExecuted: 143,
  actionsBlockedByPolicy: 12,
  humanApprovals: 37,
  historyDays: 42,
} as const;

export const MERCHANT = {
  id: "mrc_ACME1042",
  name: "Acme Commerce",
  legalName: "Acme Commerce Retail Pvt Ltd",
  mcc: "5399",
  currency: "INR" as const,
  onboardedAt: "2024-11-04T09:00:00+05:30",
};

export const PRODUCTS = [
  { id: "prd_2481", sku: "SKU-2481", name: "Aurora Buds Pro", category: "Audio", price: 3_499 },
  { id: "prd_1188", sku: "SKU-1188", name: "Nimbus Kettle 1.7L", category: "Kitchen", price: 2_150 },
  { id: "prd_3320", sku: "SKU-3320", name: "Everyday Tote", category: "Bags", price: 899 },
  { id: "prd_4471", sku: "SKU-4471", name: "Trail Runner Socks", category: "Apparel", price: 349 },
  { id: "prd_5502", sku: "SKU-5502", name: "Cold Brew Concentrate", category: "Grocery", price: 249 },
  { id: "prd_6613", sku: "SKU-6613", name: "Desk Mat XL", category: "Workspace", price: 1_299 },
  { id: "prd_7724", sku: "SKU-7724", name: "Steel Bottle 750ml", category: "Kitchen", price: 649 },
  { id: "prd_8835", sku: "SKU-8835", name: "Cable Organiser Set", category: "Workspace", price: 199 },
];

/** The refund-spike subject, referred to as "Product X" in the incident brief. */
export const ANOMALOUS_PRODUCT_ID = "prd_2481";

/**
 * Evidence transactions the investigation surfaces first. These are planted at
 * fixed IDs and amounts so the demo narration is stable; they are ordinary
 * members of the incident cohort in every other respect.
 */
export const PLANTED_EVIDENCE: { id: string; amount: number; minuteOffset: number }[] = [
  { id: "TXN_82931", amount: 18_400, minuteOffset: 37 },
  { id: "TXN_82944", amount: 12_750, minuteOffset: 41 },
  { id: "TXN_83017", amount: 9_240, minuteOffset: 52 },
  { id: "TXN_83102", amount: 7_880, minuteOffset: 64 },
  { id: "TXN_83145", amount: 6_410, minuteOffset: 71 },
  { id: "TXN_83190", amount: 5_200, minuteOffset: 83 },
];

export const UPI_ERROR_CODES = [
  {
    code: "BAD_REQUEST_ERROR",
    reason: "Payment processing failed at the issuing bank (UPI collect timeout)",
    weight: 0.62,
  },
  { code: "GATEWAY_ERROR", reason: "Issuer unavailable — no response within 30s", weight: 0.24 },
  { code: "COLLECT_EXPIRED", reason: "Collect request expired before approval", weight: 0.14 },
];

export const GENERIC_ERROR_CODES = [
  { code: "PAYMENT_DECLINED", reason: "Declined by issuing bank", weight: 0.44 },
  { code: "INSUFFICIENT_FUNDS", reason: "Insufficient balance", weight: 0.28 },
  { code: "AUTH_FAILED", reason: "Customer did not complete authentication", weight: 0.18 },
  { code: "GATEWAY_ERROR", reason: "Upstream gateway error", weight: 0.1 },
];
