# Financial Control Tower

**See financial problems before they become losses.**

An AI-native operating layer for merchants, built for the Razorpay Buildathon 2026 Open
Track. It reads a merchant's payment ledger continuously, works out what changed and why,
prices the available responses against each other, and then asks a human before it does
anything.

The centrepiece is one end-to-end flow:

> financial anomaly → AI investigation → evidence → financial impact → what-if analysis →
> recommendation → human approval → bounded Razorpay test action → **failure handling** →
> verification → audit trail

---

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and press **Enter Control Tower**.

No database, no API keys, no Docker, no background workers. Everything runs inside one
Next.js application.

```bash
npm run lint      # eslint (flat config, next/core-web-vitals + next/typescript)
npm run typecheck # tsc --noEmit
npm run build     # production build
npm run docs      # compile docs/report.tex → docs/report.pdf (needs pdflatex)
```

---

## The 4–5 minute demo

| # | Screen | What to point at |
|---|--------|------------------|
| 1 | `/command-center` | "3 things need your attention" — not a dashboard, a worklist |
| 2 | Card 1 | ₹4.82L at risk, 1,284 affected payments, 91% confidence |
| 3 | `/investigations/inv_1042` | Success rate 97.8% → 81.4%, trough 55.1% in the shaded acute window |
| 4 | Evidence | Ten items; click `TXN_82931` for the full payment-event trail |
| 5 | Root cause | Bank X share of failures 21% → 87%, and **four rejected hypotheses** |
| 6 | Financial impact | ₹4.82L at risk, ₹3.14L recoverable, marked as an estimate |
| 7 | What if? | Do nothing −₹2.10L · Retry +₹1.58L net · Alternate rail +₹2.12L net |
| 8 | Review action → `/actions/act_2040` | Approve the **retry** first to show the failure path |
| 9 | Execution | prepare → policy → eligibility → gateway → **halted** |
| 10 | Failure panel | Temporary payment failure; MAX_RETRY_ATTEMPTS reached; agent refuses to keep retrying |
| 11 | Review alternative → `/actions/act_2041` | Approve; watch it complete and verify |
| 12 | Result | ₹1,41,175 recovered across 130 of 184, against ₹1,42,080 modelled |
| 13 | `/audit` | Filter **Failure** — detection → approval → API → failure → fallback → recovery |
| 14 | `/memory` | Why 8.9% is an anomaly: the merchant's own 3.7% baseline over 33 days |

Closing line:

> Most financial software tells merchants what happened. Financial Control Tower helps
> decide what should happen next — safely.

**Reset between runs:** sidebar → **Environment** → *Reset demo*. The same panel has
*Run detection pipeline*, which re-executes observe → detect → investigate → simulate →
recommend over the seeded ledger and reports the timing of each stage.

---

## Demo Mode and Live Test Mode

The application never pretends an external call happened.

| | Demo Mode (default) | Live Test Mode |
|---|---|---|
| Trigger | no `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | test key pair present |
| Badge | `DEMO — SYNTHETIC DATA` | `LIVE TEST MODE` |
| Gateway | local adapter; responses say *"no request was sent to Razorpay"* | real `POST /v1/orders`, `GET /v1/orders/:id/payments` against Razorpay test |
| Money | none | none — test mode only; a non-`rzp_test_` key is refused outright |

The language model is optional in the same way. With `ANTHROPIC_API_KEY` set, the model
rewrites the investigation summary as prose and the badge reads *LLM-assisted narration*.
Without it, the deterministic summary is shown. **Detection, evidence assembly, scoring,
policy and execution never involve the model at all** — see below.

---

## Decision safety

This is the part that matters for a payments platform.

```
LLM (narration / scenario nomination only)
  ↓  Zod validation          lib/validation/schemas.ts
  ↓  policy engine           lib/policies/policyEngine.ts    ← deterministic, server-only
  ↓  human approval          /actions/[id]                   ← required above low risk
  ↓  action executor         lib/ai/actionExecutor.ts        ← only component with gateway access
  ↓  Razorpay test API       lib/razorpay/client.ts          ← refuses non-test keys
  ↓  verification            lib/ai/verification.ts          ← re-reads the ledger
  ↓  audit event             lib/audit/events.ts
```

Concretely:

- The executor accepts an **action id**, never an instruction. The cohort, the amounts, the
  ceiling and the gateway target are all re-derived server-side from the stored plan.
- Operator constraints sent from the browser can only **narrow** an action. `resolveCohort`
  takes `Math.min(plan, request)`, so a client asking for a larger cohort tightens the
  action instead of widening it.
- The only structured output the model may produce is one of the scenario keys the
  counterfactual engine already scored, validated by Zod. It cannot name an endpoint, an
  amount, a cohort or a policy.
- The per-customer ceiling is visibly doing work: the six largest failures in the incident
  (₹59,880) sit above ₹5,000 and are held out of automation entirely, shown on the action
  page as *Held for manual approval*.

### Policy — `RECOVERY_V2 · 2.3`

| Rule | Value | Why |
|---|---|---|
| `MAX_AUTO_ACTION_AMOUNT` | ₹5,000 / customer | Bounds the worst case of a mis-targeted action to a reversible sum |
| `MAX_RETRY_ATTEMPTS` | 2 / transaction | Repeated retries on a degraded rail add cost and trip issuer risk rules |
| `MAX_DISCOUNT_PERCENT` | 10% | Beyond this, recovery costs more than the order earns |
| `HIGH_RISK_REQUIRES_APPROVAL` | true | Customer-contacting actions carry consequences the model cannot price |
| `MAX_CUSTOMERS_PER_ACTION` | 500 | Blast-radius ceiling before a human sees a result |
| `TEST_MODE_ONLY` | true | No live-money credential is loadable |

---

## The seeded batch

Everything is generated from `DEMO_SEED = 20260218` with a fixed clock of
`2026-02-18T16:45:00+05:30`. `Math.random()` is not used anywhere.

| | |
|---|---|
| Transactions | 10,000 (24h) · 8,533 captured · 1,467 failed |
| Captured value | ₹18,42,000 · AOV ₹216 |
| Customers / products | 3,200 / 8 |
| History | 42 daily aggregates for baselines |
| Also generated | refunds, chargebacks, settlements, checkout sessions, subscriptions, invoices |

Headline figures are hit **by construction**, not by luck — amounts are scaled to exact
totals and segment shares are struck by even stride rather than sampled:

| Figure | Value |
|---|---|
| Revenue at risk (UPI incident) | ₹4,82,000 across 1,284 payments |
| Modelled recoverable | ₹3,14,000 (65.2% amount-weighted) |
| Success rate before / after 09:12 | 97.8% → 81.4% |
| Acute window trough (14:30–16:10) | 55.1% |
| Bank X share of failures | 21% baseline → 87% incident (4.1×) |
| High-intent cohort | 184 customers · ₹1,92,000 · all under the ₹5,000 ceiling |
| Rollup: at risk / recoverable / recovered | ₹8.42L / ₹5.17L / ₹3.84L |

`GET /api/diagnostics` returns all of these computed live — useful when changing the
generator.

### Five required anomalies

1. **UPI payment degradation** — `inv_1042`, ₹4.82L, critical
2. **Refund spike on one SKU** — `inv_1043`, Aurora Buds Pro 3.7% → 8.9%, ₹1.10L
3. **Checkout conversion drop** — `inv_1044`, 93.8% → 91.8%, 61 sessions, ₹72K
4. **Settlement discrepancy** — `inv_1045`, ₹38K unreconciled on 1 of 14 cycles
5. **Recoverable failed payments** — 184 high-intent customers, ₹1.26L

---

## Architecture

One Next.js 16 App Router application. Server Components read the domain modules directly;
Client Components exist only where there is interaction.

```
app/
  page.tsx                    landing
  (app)/                      shell: sidebar, top bar, session provider
    command-center/           what needs attention
    investigations/[id]/      the investigation workspace
    opportunities/[id]/       money still retrievable, ranked by value
    memory/                   learned baselines
    actions/[id]/             approval + staged execution
    audit/                    the full chain
  api/                        route handlers (actions, investigations, transactions,
                              search, audit, memory, opportunities, ai/control,
                              razorpay/status, demo/trigger, diagnostics)
lib/
  demo/       rng.ts · config.ts · dataset.ts      deterministic ledger
  analytics/  metrics.ts · opportunities.ts        every displayed figure
  ai/         observer · merchantMemory · anomalyDetector · investigator ·
              counterfactualEngine · decisionEngine · actionExecutor ·
              verification · llm
  policies/   policyEngine.ts
  razorpay/   client.ts        server-only, test-mode-only
  validation/ schemas.ts       Zod
  audit/      events.ts
components/   control-tower · investigation · actions · audit · memory · charts · ui
prisma/       schema.prisma    the relational model, for a persistent deployment
docs/         report.tex → report.pdf
```

### The ten-stage loop and where it lives

| Stage | Module |
|---|---|
| Observe | `lib/ai/observer.ts` |
| Remember | `lib/ai/merchantMemory.ts` |
| Detect | `lib/ai/anomalyDetector.ts` |
| Investigate | `lib/ai/investigator.ts` |
| Simulate | `lib/ai/counterfactualEngine.ts` |
| Recommend | `lib/ai/decisionEngine.ts` |
| Approve | `lib/policies/policyEngine.ts` + `/actions/[id]` |
| Act | `lib/ai/actionExecutor.ts` |
| Verify | `lib/ai/verification.ts` |
| Learn | `lib/ai/merchantMemory.ts` |

### Persistence

`prisma/schema.prisma` documents the relational model — Merchant, Customer, Product,
Transaction, PaymentEvent, Refund, Chargeback, Settlement, CheckoutSession, Subscription,
Invoice, Anomaly, Investigation, Evidence, TimelineEntry, Scenario, Recommendation, Action,
ActionResult, AuditEvent, MerchantMemory, Policy. The in-memory dataset mirrors it
one-for-one and `lib/types.ts` matches it field for field, so moving to Postgres is a
repository-layer change rather than a UI change. The Prisma packages are deliberately not
installed: the demo must not require a database to run.

Session state — which actions the operator approved, executed or rejected, and the audit
events those produced — lives in `localStorage` behind a `useSyncExternalStore`. That keeps
the server read path a pure function of the seed, survives a serverless cold start, and
makes *Reset demo* exact.

---

## Deploy

```bash
vercel
```

Or push to GitHub and import the repository. One project, no separate backend, no Python,
no Docker, no Redis, no workers. Every route handler is a serverless function; every page is
server-rendered on demand.

Environment variables are all optional — see `.env.example`. With none set, the deployed
application runs in full Demo Mode.

---

## Report

`docs/report.tex` is a two-column technical report covering the architecture, data model,
detection and investigation method, the counterfactual scoring, the decision-safety
pipeline, the policy table, the graceful-failure walkthrough, the audit schema, results and
limitations. Compile with:

```bash
cd docs && pdflatex -interaction=nonstopmode report.tex && pdflatex -interaction=nonstopmode report.tex
```

The compiled `docs/report.pdf` is committed alongside the source.

---

## Honest limitations

- All data is synthetic and generated from a seed. No real merchant or customer data is
  present, and none of the figures describe a real business.
- "Recovered" in Demo Mode is a modelled outcome over the seeded cohort, not collected
  money. In Live Test Mode the gateway calls are real, but they create test-mode order
  objects — the recovery value is still modelled, and the UI says so in the result message.
- The recovery model is a calibrated per-transaction probability, not a trained model. A
  production version would fit it on the merchant's own historical recovery outcomes.
- Anomaly detection is threshold-and-baseline, not statistical process control. That is a
  deliberate choice for a demo where determinism matters more than sophistication.
- Session state is per-browser. A production deployment would persist actions and audit
  events to Postgres via the Prisma schema included here.
