import { z } from "zod";

/**
 * Every request that can change state, and every structured output a language
 * model is allowed to produce, passes through one of these schemas before it
 * reaches the policy engine. Anything that does not parse is rejected before a
 * decision is made — the model never gets to widen its own permissions by
 * emitting extra fields.
 */

export const actionIdSchema = z
  .string()
  .regex(/^act_[0-9]{4}$/, "Action id must look like act_1234");

export const investigationIdSchema = z
  .string()
  .regex(/^inv_[0-9]{4}$/, "Investigation id must look like inv_1234");

export const transactionIdSchema = z
  .string()
  .regex(/^TXN_[0-9]{5}$/, "Transaction id must look like TXN_12345");

export const executionStageSchema = z.enum([
  "prepare",
  "policy",
  "eligibility",
  "gateway",
  "verify",
]);

/**
 * Operator constraints. Both fields may only make an action *narrower*; the
 * executor takes the minimum of the plan and the request, so a client cannot
 * widen a cohort or raise a ceiling by sending a larger number.
 */
export const constraintsSchema = z
  .object({
    maxCustomers: z.number().int().positive().max(500).optional(),
    maxAmountPerCustomer: z.number().int().positive().max(5000).optional(),
  })
  .optional();

export const executeRequestSchema = z.object({
  stage: executionStageSchema,
  constraints: constraintsSchema,
});

export type ExecutionConstraints = z.infer<typeof constraintsSchema>;

export const rejectRequestSchema = z.object({
  reason: z.string().min(3).max(280).default("No reason given"),
});

/**
 * The only shape a language model is permitted to return when it proposes an
 * intervention. Note what is absent: no endpoint, no amount override, no
 * customer list, no ability to name a policy. The model may nominate one of the
 * scenarios the counterfactual engine already scored, and nothing else.
 */
export const llmRecommendationSchema = z.object({
  scenarioKey: z.enum(["do_nothing", "retry", "alternate_method"]),
  headline: z.string().min(8).max(140),
  reason: z.string().min(20).max(600),
  confidence: z.number().min(0).max(1),
});

export type LlmRecommendation = z.infer<typeof llmRecommendationSchema>;

export const llmNarrativeSchema = z.object({
  summary: z.string().min(40).max(900),
});

export function parseOrNull<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
