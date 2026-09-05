import "server-only";

/**
 * Razorpay integration — server-side only.
 *
 * Two modes, and the product always says which one it is in:
 *
 *  · MOCK      — no credentials configured. Every call is answered by a local
 *                adapter. Nothing leaves the process and the UI labels the
 *                result as simulated. We never claim an API call happened.
 *  · TEST      — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are present and the key
 *                is a test key (rzp_test_*). Real HTTPS calls are made to
 *                Razorpay's test environment. No live key is ever accepted.
 *
 * Secrets are read from the environment inside this module and never returned
 * to a caller, serialised into a response, or referenced from a client bundle.
 */

const API_BASE = "https://api.razorpay.com/v1";

export type RazorpayMode = "mock" | "test";

export interface RazorpayModeInfo {
  mode: RazorpayMode;
  label: string;
  detail: string;
  keyIdPreview?: string;
}

function keyId(): string | undefined {
  const id = process.env.RAZORPAY_KEY_ID?.trim();
  return id && id.length > 0 ? id : undefined;
}

function keySecret(): string | undefined {
  const s = process.env.RAZORPAY_KEY_SECRET?.trim();
  return s && s.length > 0 ? s : undefined;
}

/** Refuses anything that is not an explicit test key. */
function assertTestMode(id: string) {
  if (!id.startsWith("rzp_test_")) {
    throw new Error(
      "RAZORPAY_KEY_ID is not a test key. Financial Control Tower refuses to load live-mode credentials.",
    );
  }
}

export function getMode(): RazorpayModeInfo {
  const id = keyId();
  const secret = keySecret();
  if (!id || !secret) {
    return {
      mode: "mock",
      label: "SANDBOX MODE",
      detail:
        "No Razorpay credentials configured. Gateway calls are answered by a local adapter and are labelled as simulated.",
    };
  }
  try {
    assertTestMode(id);
  } catch {
    return {
      mode: "mock",
      label: "SANDBOX MODE",
      detail: "Configured key is not a test key; live credentials are refused. Falling back to the local adapter.",
    };
  }
  return {
    mode: "test",
    label: "LIVE TEST MODE",
    detail: "Connected to the Razorpay test environment. No live-mode credential is accepted and no real money moves.",
    keyIdPreview: `${id.slice(0, 12)}…${id.slice(-4)}`,
  };
}

function authHeader(): string {
  const id = keyId()!;
  const secret = keySecret()!;
  assertTestMode(id);
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export interface GatewayCall {
  endpoint: string;
  method: "GET" | "POST";
  ok: boolean;
  httpStatus?: number;
  code: string;
  message: string;
  reference?: string;
  mode: RazorpayMode;
  latencyMs: number;
}

async function call(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const started = Date.now();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  void started;
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { ok: res.ok, status: res.status, json };
}

/** Verifies credentials without creating anything. */
export async function ping(): Promise<GatewayCall> {
  const mode = getMode().mode;
  const t0 = Date.now();
  if (mode === "mock") {
    return {
      endpoint: "local adapter",
      method: "GET",
      ok: true,
      code: "MOCK_ADAPTER_READY",
      message: "Local adapter ready. No external request was made.",
      mode,
      latencyMs: 0,
    };
  }
  try {
    const r = await call("/payments?count=1", "GET");
    return {
      endpoint: "GET /v1/payments?count=1",
      method: "GET",
      ok: r.ok,
      httpStatus: r.status,
      code: r.ok ? "TEST_CREDENTIALS_OK" : "TEST_CREDENTIALS_REJECTED",
      message: r.ok
        ? "Razorpay test credentials verified."
        : `Razorpay returned HTTP ${r.status}.`,
      mode,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      endpoint: "GET /v1/payments?count=1",
      method: "GET",
      ok: false,
      code: "TEST_API_UNREACHABLE",
      message: err instanceof Error ? err.message : "Razorpay test API unreachable.",
      mode,
      latencyMs: Date.now() - t0,
    };
  }
}

/**
 * Create a test-mode recovery order.
 *
 * In TEST mode this is a genuine `POST /v1/orders` against Razorpay's test
 * environment — an order object is created and no money moves. In MOCK mode a
 * local reference is returned and the caller is told, in the response, that
 * nothing was sent anywhere.
 */
export async function createRecoveryOrder(input: {
  amount: number; // rupees
  receipt: string;
  notes: Record<string, string>;
}): Promise<GatewayCall> {
  const info = getMode();
  const t0 = Date.now();
  if (info.mode === "mock") {
    return {
      endpoint: "local adapter · orders.create",
      method: "POST",
      ok: true,
      code: "MOCK_ORDER_CREATED",
      message: "Simulated by the local adapter. No request was sent to Razorpay.",
      reference: `order_MOCK${input.receipt.replace(/[^0-9A-Za-z]/g, "").slice(-10).toUpperCase()}`,
      mode: "mock",
      latencyMs: Date.now() - t0,
    };
  }
  try {
    const r = await call("/orders", "POST", {
      amount: Math.round(input.amount * 100), // paise
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    });
    return {
      endpoint: "POST /v1/orders",
      method: "POST",
      ok: r.ok,
      httpStatus: r.status,
      code: r.ok ? "TEST_ORDER_CREATED" : "TEST_ORDER_REJECTED",
      message: r.ok
        ? "Test-mode order created. Recovery value is modelled, not collected."
        : `Razorpay returned HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 180)}`,
      reference: typeof r.json.id === "string" ? r.json.id : undefined,
      mode: "test",
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      endpoint: "POST /v1/orders",
      method: "POST",
      ok: false,
      code: "TEST_API_UNREACHABLE",
      message: err instanceof Error ? err.message : "Razorpay test API unreachable.",
      mode: "test",
      latencyMs: Date.now() - t0,
    };
  }
}

/**
 * Check whether any payment was captured against a recovery order.
 * Used by the retry path: an order with no captured payment inside the attempt
 * window is a real, observed negative result — not a fabricated failure.
 */
export async function fetchOrderPayments(orderId: string): Promise<GatewayCall> {
  const info = getMode();
  const t0 = Date.now();
  if (info.mode === "mock") {
    return {
      endpoint: "local adapter · orders.payments",
      method: "GET",
      ok: true,
      code: "MOCK_NO_PAYMENTS",
      message: "Simulated by the local adapter: no payment captured against the retry order.",
      reference: orderId,
      mode: "mock",
      latencyMs: Date.now() - t0,
    };
  }
  try {
    const r = await call(`/orders/${orderId}/payments`, "GET");
    const items = Array.isArray(r.json.items) ? (r.json.items as unknown[]) : [];
    return {
      endpoint: `GET /v1/orders/${orderId}/payments`,
      method: "GET",
      ok: r.ok,
      httpStatus: r.status,
      code: items.length > 0 ? "TEST_PAYMENT_FOUND" : "TEST_NO_PAYMENT_CAPTURED",
      message:
        items.length > 0
          ? `${items.length} payment(s) found against the order.`
          : "No payment captured against the retry order inside the attempt window.",
      reference: orderId,
      mode: "test",
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      endpoint: `GET /v1/orders/${orderId}/payments`,
      method: "GET",
      ok: false,
      code: "TEST_API_UNREACHABLE",
      message: err instanceof Error ? err.message : "Razorpay test API unreachable.",
      mode: "test",
      latencyMs: Date.now() - t0,
    };
  }
}
