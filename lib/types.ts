/**
 * Domain types for Financial Control Tower.
 *
 * These mirror `prisma/schema.prisma` one-for-one. The demo runs against a
 * deterministic in-memory materialisation of the same shapes so the product is
 * fully functional with zero external services; swapping in Prisma is a
 * repository-layer change, not a UI change.
 */

export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet";
export type DeviceType = "android" | "ios" | "web";
export type TransactionStatus = "captured" | "failed" | "refunded";

export interface Merchant {
  id: string;
  name: string;
  legalName: string;
  mcc: string;
  currency: "INR";
  onboardedAt: string;
}

export interface Customer {
  id: string;
  handle: string;
  firstSeenAt: string;
  lifetimeValue: number;
  orders: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
}

export interface Transaction {
  id: string;
  merchantId: string;
  customerId: string;
  productId: string;
  amount: number; // rupees
  currency: "INR";
  method: PaymentMethod;
  bank: string;
  device: DeviceType;
  status: TransactionStatus;
  createdAt: string; // ISO-8601
  errorCode?: string;
  errorReason?: string;
  /** Anomaly this transaction is attributed to, if any. */
  anomalyId?: string;
  /** Deterministic model output, only present on failed transactions. */
  recoveryProbability?: number;
  /** Member of the bounded cohort a recovery action is permitted to target. */
  highIntent?: boolean;
  vpa?: string;
  rrn?: string;
}

export interface PaymentEvent {
  id: string;
  transactionId: string;
  at: string;
  type: "created" | "authorized" | "captured" | "failed" | "retried" | "refunded";
  gatewayCode?: string;
  detail: string;
}

export interface Refund {
  id: string;
  transactionId: string;
  productId: string;
  amount: number;
  reason: string;
  createdAt: string;
  status: "processed" | "pending";
}

export interface Chargeback {
  id: string;
  transactionId: string;
  amount: number;
  reasonCode: string;
  createdAt: string;
  status: "open" | "represented" | "lost";
}

export interface Settlement {
  id: string;
  utr: string;
  amount: number;
  fees: number;
  tax: number;
  expectedAt: string;
  settledAt?: string;
  status: "settled" | "processing" | "discrepancy";
  varianceAmount: number;
  transactionCount: number;
}

export interface CheckoutSession {
  id: string;
  customerId: string;
  productId: string;
  amount: number;
  createdAt: string;
  stage: "cart" | "contact" | "method_select" | "auth" | "completed";
  completed: boolean;
  dropOffReason?: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planName: string;
  amount: number;
  interval: "monthly" | "quarterly";
  status: "active" | "halted" | "cancelled";
  nextChargeAt: string;
  failedCharges: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  amount: number;
  issuedAt: string;
  dueAt: string;
  status: "paid" | "overdue" | "issued";
  daysOverdue: number;
}

export type Severity = "critical" | "opportunity" | "watch";

export interface Anomaly {
  id: string;
  kind:
    | "payment_degradation"
    | "refund_spike"
    | "checkout_drop"
    | "settlement_discrepancy"
    | "recoverable_failures"
    | "chargeback_exposure"
    | "receivables_ageing"
    | "fraud_pattern"
    | "duplicate_charge";
  title: string;
  severity: Severity;
  detectedAt: string;
  /** One-line statement of the finding, always with a number in it. */
  headline: string;
  detail: string;
  /** Rupees of revenue exposed by this anomaly. */
  impact: number;
  /** Rupees the recovery model expects to be retrievable. */
  recoverable: number;
  confidence: number; // 0..1
  observedValue: number;
  baselineValue: number;
  unit: "percent" | "ratio" | "count" | "inr" | "days";
  affectedCount: number;
  investigationId?: string;
  metricLabel: string;
}

export interface EvidenceItem {
  id: string;
  investigationId: string;
  kind: "transaction" | "aggregate" | "comparison" | "timeseries";
  label: string;
  transactionId?: string;
  weight: number;
  summary: string;
  facts: { label: string; value: string; mono?: boolean }[];
}

export interface RootCause {
  statement: string;
  mechanism: string;
  observedShare: number;
  baselineShare: number;
  shareLabel: string;
  supportingEvidenceIds: string[];
  alternativesConsidered: { hypothesis: string; verdict: string; rejectedBecause: string }[];
}

export interface TimelineEntry {
  at: string;
  label: string;
  actor: "ai" | "merchant" | "api" | "policy" | "system";
  detail?: string;
}

export interface Scenario {
  id: string;
  key: "do_nothing" | "retry" | "alternate_method";
  name: string;
  description: string;
  expectedRecovery: number;
  expectedCost: number;
  expectedAdditionalLoss: number;
  netExpectedBenefit: number;
  probability: number;
  customerContactRisk: "none" | "low" | "medium" | "high";
  reachableCustomers: number;
  recommended: boolean;
  linkedActionId?: string;
  assumptions: string[];
}

export interface Recommendation {
  id: string;
  investigationId: string;
  scenarioKey: Scenario["key"];
  statement: string;
  reason: string;
  generatedBy: "deterministic_decision_engine" | "llm_assisted";
  linkedActionId: string;
}

export interface Investigation {
  id: string;
  anomalyId: string;
  title: string;
  status: "investigating" | "resolved" | "monitoring" | "action_pending";
  severity: Severity;
  impact: number;
  recoverable: number;
  confidence: number;
  openedAt: string;
  summary: string;
  metrics: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "danger" }[];
  evidence: EvidenceItem[];
  rootCause: RootCause;
  timeline: TimelineEntry[];
  scenarios: Scenario[];
  recommendation: Recommendation;
  affectedCount: number;
  segmentBreakdown: { label: string; incident: number; baseline: number }[];
  successRateSeries: { t: string; rate: number; baseline: number }[];
}

export type ActionStatus =
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "rejected"
  | "blocked_by_policy";

export interface ActionPlan {
  id: string;
  investigationId: string;
  scenarioKey: Scenario["key"];
  kind:
    | "payment_retry"
    | "alternate_method_offer"
    | "refund_hold"
    | "settlement_reconcile"
    | "fraud_block"
    | "duplicate_refund";
  title: string;
  description: string;
  status: ActionStatus;
  createdAt: string;
  createdBy: "decision_engine";
  policyId: string;
  targetCustomers: number;
  maxAmountPerCustomer: number;
  maxAttempts: number;
  attemptsUsed: number;
  totalExposure: number;
  expectedRecovery: number;
  successProbability: number;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  rationale: string;
  guardrails: { label: string; value: string }[];
  /** Deterministic demo outcome the executor will produce. */
  demoOutcome: "success" | "temporary_failure";
  fallbackActionId?: string;
  parentActionId?: string;
  approvedAt?: string;
  result?: ActionResult;
}

export interface ActionResult {
  actionId: string;
  ok: boolean;
  at: string;
  code: string;
  message: string;
  recoveredAmount: number;
  attempted: number;
  succeeded: number;
  failed: number;
  gateway: "razorpay_test_api" | "razorpay_mock_adapter";
  gatewayReference?: string;
  verification?: VerificationReport;
  fallbackActionId?: string;
}

export interface VerificationReport {
  checkedAt: string;
  checks: { label: string; passed: boolean; detail: string }[];
  ledgerDelta: number;
  verdict: "verified" | "partial" | "not_verified";
}

export type AuditActor = "ai" | "merchant" | "api" | "policy" | "system";

export interface AuditEvent {
  id: string;
  at: string;
  actor: AuditActor;
  event: string;
  detail: string;
  refType: "transaction" | "investigation" | "action" | "policy" | "anomaly" | "settlement" | "none";
  refId: string;
  result: "ok" | "failed" | "blocked" | "info";
}

export interface MerchantMemoryRecord {
  id: string;
  key: string;
  title: string;
  statement: string;
  baselineLabel: string;
  baselineValue: string;
  currentLabel: string;
  currentValue: string;
  status: "normal" | "unusual" | "drifting";
  confidence: number;
  observations: number;
  source: string;
  learnedFrom: string;
  lastUpdated: string;
  why: string;
  evidence: { label: string; value: string; mono?: boolean }[];
  series: { label: string; value: number }[];
  unit: string;
}

export interface Opportunity {
  id: string;
  title: string;
  value: number;
  subject: string;
  confidence: number;
  detail: string;
  cta: { label: string; href: string };
  basis: string;
  anomalyId?: string;
}

export interface PolicyRule {
  key: string;
  value: string;
  description: string;
  rationale: string;
  enforcedIn: string;
}

export interface Policy {
  id: string;
  name: string;
  version: string;
  effectiveFrom: string;
  rules: PolicyRule[];
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  violations: { rule: string; message: string }[];
  checks: { rule: string; passed: boolean; detail: string }[];
  policyId: string;
}

export interface OverviewMetrics {
  processedToday: number;
  processedDelta: number;
  transactionsAnalyzed: number;
  capturedCount: number;
  failedCount: number;
  refundCount: number;
  refundValue: number;
  revenueAtRisk: number;
  potentialRecovery: number;
  recovered: number;
  anomaliesDetected: number;
  investigations: number;
  actionsExecuted: number;
  actionsBlocked: number;
  humanApprovals: number;
  avgTransactionValue: number;
  settlementDelayDays: number;
  successRate: number;
  baselineSuccessRate: number;
  hourly: { hour: string; captured: number; failed: number; value: number }[];
  daily: { day: string; label: string; revenue: number; refunds: number; atRisk: number }[];
}
