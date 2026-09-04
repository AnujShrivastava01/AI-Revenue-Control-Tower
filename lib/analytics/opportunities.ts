import {
  getChargebackStats,
  getCheckoutStats,
  getIncidentStats,
  getReceivablesStats,
  getRefundStats,
  getSettlementStats,
} from "./metrics";
import * as C from "@/lib/demo/config";
import { formatPercent, formatShortINR } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";

/**
 * Opportunities are anomalies expressed as money the merchant could still get,
 * ranked by expected financial value rather than by severity. Every entry links
 * to the work that would realise it.
 */
export function getOpportunities(): Opportunity[] {
  const incident = getIncidentStats();
  const refunds = getRefundStats();
  const checkout = getCheckoutStats();
  const receivables = getReceivablesStats();
  const chargebacks = getChargebackStats();
  const settlement = getSettlementStats();

  const list: Opportunity[] = [
    {
      id: "opp_recovery",
      title: "Recoverable revenue",
      value: incident.recoverable,
      subject: `${incident.affected.toLocaleString("en-IN")} failed payments · ${incident.highIntentCount} high-intent customers`,
      confidence: 0.82,
      detail:
        "Failed payments from the open UPI incident, scored one by one against this merchant's own recovery history. The bounded first tranche targets the high-intent cohort.",
      basis: `Amount-weighted expectation over ${incident.affected.toLocaleString("en-IN")} payments, mean recovery probability ${formatPercent(incident.recoverableRate, 1)}.`,
      cta: { label: "Review recovery", href: "/actions/act_2041" },
      anomalyId: "anm_upi_degradation",
    },
    {
      id: "opp_refunds",
      title: "Refund reduction",
      value: C.ANOMALY_LEDGER.refund_spike.impact,
      subject: `${refunds.product.name} · ${refunds.product.sku}`,
      confidence: 0.88,
      detail: `Refund rate on this SKU moved ${formatPercent(refunds.baselineRate)} → ${formatPercent(refunds.currentRate)} nine days ago. Containing it recovers most of the excess.`,
      basis: `Excess refund value over the 42-day baseline across the 9 elevated days; ${formatShortINR(C.ANOMALY_LEDGER.refund_spike.recoverable)} of it is modelled recoverable through containment.`,
      cta: { label: "Investigate", href: "/investigations/inv_1043" },
      anomalyId: "anm_refund_spike",
    },
    {
      id: "opp_receivables",
      title: "Overdue receivables",
      value: receivables.value,
      subject: `${receivables.count} invoices · average ${receivables.avgDaysOverdue} days overdue`,
      confidence: 0.79,
      detail:
        "Invoices past due where the customer is still transacting. Collection probability falls sharply after day 60, so sequence matters more than volume.",
      basis: "Sum of open invoice value with status = overdue.",
      cta: { label: "Review", href: "/opportunities/opp_receivables" },
      anomalyId: "anm_receivables",
    },
    {
      id: "opp_checkout",
      title: "Checkout recovery",
      value: checkout.abandonedValue,
      subject: `${checkout.abandonedCount} abandoned sessions`,
      confidence: 0.76,
      detail:
        "Sessions abandoned at payment-method selection today, downstream of the UPI failures. A presentation change reaches them without contacting anyone.",
      basis: "Sum of cart value across sessions that did not complete.",
      cta: { label: "Investigate", href: "/investigations/inv_1044" },
      anomalyId: "anm_checkout_drop",
    },
    {
      id: "opp_chargebacks",
      title: "Chargeback representment",
      value: chargebacks.exposure,
      subject: `${chargebacks.openCount} disputes inside the representment window`,
      confidence: 0.72,
      detail:
        "Order and delivery records are already on file for these disputes, so evidence bundles can be assembled without new work.",
      basis: "Sum of disputed value across open and representable chargebacks.",
      cta: { label: "Review", href: "/opportunities/opp_chargebacks" },
      anomalyId: "anm_chargeback_exposure",
    },
    {
      id: "opp_settlement",
      title: "Settlement discrepancy",
      value: settlement.varianceAmount,
      subject: `${settlement.discrepancy?.utr ?? "one cycle"} · 1 of 14 cycles`,
      confidence: 0.84,
      detail:
        "A single cycle settled short of the captured total after fees and tax. The transaction-level match is complete, so it can be filed as an evidenced claim.",
      basis: "Captured value less fees and tax, minus the settled amount.",
      cta: { label: "Investigate", href: "/investigations/inv_1045" },
      anomalyId: "anm_settlement_discrepancy",
    },
  ];

  return list.sort((a, b) => b.value - a.value);
}

export function getOpportunity(id: string): Opportunity | undefined {
  return getOpportunities().find((o) => o.id === id);
}
