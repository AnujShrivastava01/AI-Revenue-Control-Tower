import "server-only";
import { llmNarrativeSchema, llmRecommendationSchema, type LlmRecommendation } from "@/lib/validation/schemas";
import type { Investigation } from "@/lib/types";

/**
 * Language-model abstraction.
 *
 * Two hard boundaries, both enforced here rather than by convention:
 *
 *  1. The model is given *already-computed* figures and asked to explain them.
 *     It is never asked to produce a number that the product then displays.
 *  2. The model's only structured output is a scenario key drawn from the set
 *     the counterfactual engine already scored, validated by Zod. It cannot
 *     name an endpoint, an amount, a cohort or a policy.
 *
 * With no API key configured, every function falls back to the deterministic
 * text the rest of the product uses. Nothing degrades and nothing is faked.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.AI_MODEL?.trim() || "claude-sonnet-5";

export interface AiStatus {
  enabled: boolean;
  provider: "anthropic" | "none";
  model: string | null;
  label: string;
  detail: string;
}

export function getAiStatus(): AiStatus {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return {
      enabled: false,
      provider: "none",
      model: null,
      label: "Deterministic reasoning",
      detail:
        "No model key configured. Detection, investigation, scoring and policy run locally and deterministically — the language model only ever adds narration on top.",
    };
  }
  return {
    enabled: true,
    provider: "anthropic",
    model: MODEL,
    label: "LLM-assisted narration",
    detail: `${MODEL} is used for explanatory prose only. Every figure on screen is computed by the analytics layer, and the model cannot execute an action.`,
  };
}

async function complete(system: string, user: string, maxTokens = 700): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text;
    return text?.trim() ?? null;
  } catch {
    return null;
  }
}

const NARRATOR_SYSTEM = `You write incident summaries for a merchant payments operations product.
Rules:
- Use only the figures given to you. Never introduce a number that is not in the input.
- Plain, concrete, unhurried. No marketing language, no "AI-powered", no exclamation marks.
- 3 to 5 sentences. State what changed, where it is concentrated, and what it is not.
- Return the summary text only, with no preamble and no formatting.`;

export interface Narration {
  text: string;
  generatedBy: "llm_assisted" | "deterministic";
}

/** Explanatory prose for an investigation. Falls back to the built-in summary. */
export async function narrateInvestigation(inv: Investigation): Promise<Narration> {
  const status = getAiStatus();
  if (!status.enabled) return { text: inv.summary, generatedBy: "deterministic" };

  const facts = [
    `Title: ${inv.title}`,
    `Severity: ${inv.severity}`,
    `Affected payments: ${inv.affectedCount}`,
    `Revenue at risk: ₹${inv.impact}`,
    `Modelled recoverable: ₹${inv.recoverable}`,
    `Confidence: ${Math.round(inv.confidence * 100)}%`,
    `Root cause: ${inv.rootCause.statement}`,
    `Mechanism: ${inv.rootCause.mechanism}`,
    ...inv.segmentBreakdown.map(
      (s) => `Segment ${s.label}: ${(s.incident * 100).toFixed(0)}% in incident vs ${(s.baseline * 100).toFixed(0)}% baseline`,
    ),
    ...inv.rootCause.alternativesConsidered.map(
      (a) => `Considered and ${a.verdict.toLowerCase()}: ${a.hypothesis} — ${a.rejectedBecause}`,
    ),
  ].join("\n");

  const raw = await complete(NARRATOR_SYSTEM, facts);
  const parsed = raw ? llmNarrativeSchema.safeParse({ summary: raw }) : null;
  if (!parsed?.success) return { text: inv.summary, generatedBy: "deterministic" };
  return { text: parsed.data.summary, generatedBy: "llm_assisted" };
}

const ADVISOR_SYSTEM = `You are choosing between pre-scored intervention scenarios for a payments incident.
You may not invent options, amounts, cohorts or endpoints. Choose exactly one of the scenario keys provided.
Respond with a single JSON object and nothing else:
{"scenarioKey": "...", "headline": "...", "reason": "...", "confidence": 0.0}`;

/**
 * Ask the model to nominate one of the already-scored scenarios.
 * The result is Zod-validated and then handed to the policy engine like any
 * other proposal. A malformed or unexpected answer is discarded, and the
 * deterministic engine's choice stands.
 */
export async function nominateScenario(input: {
  scenarios: { key: string; name: string; expectedRecovery: number; expectedCost: number; netExpectedBenefit: number }[];
}): Promise<LlmRecommendation | null> {
  if (!getAiStatus().enabled) return null;
  const raw = await complete(
    ADVISOR_SYSTEM,
    JSON.stringify({ scenarios: input.scenarios }, null, 2),
    400,
  );
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const parsed = llmRecommendationSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
