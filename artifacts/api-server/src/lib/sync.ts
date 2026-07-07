/**
 * Model sync: registers all enabled Qillin DB models into LiteLLM on startup.
 *
 * Models added to Qillin while LiteLLM was down are not registered there,
 * so chat completions fail with "Invalid model name". This sync fixes the gap.
 */
import { db } from "../db/index.js";
import { litellmAddModel, litellmListModels, isLiteLLMAvailable } from "./litellm.js";
import { logger } from "./logger.js";

/**
 * Build the litellm_params.model string for a given provider type.
 *
 * LiteLLM requires the "openai/<model>" prefix for custom OpenAI-compatible
 * endpoints so it knows which protocol to use. Without it, non-standard model
 * names (e.g. "gigi/deepseek-v4-pro") are treated as unknown and LiteLLM
 * refuses to route them.
 *
 * For native Anthropic providers the prefix is "anthropic/".
 * For known OpenAI models pointed at the official API, no prefix is needed
 * (LiteLLM already knows them), but adding "openai/" is still safe.
 */
export function litellmModelString(litellmModel: string, providerType: string): string {
  // Don't double-prefix
  if (litellmModel.startsWith("openai/") || litellmModel.startsWith("anthropic/")) {
    return litellmModel;
  }
  if (providerType === "anthropic") {
    return `anthropic/${litellmModel}`;
  }
  // "custom" and "openai" both use the OpenAI-compatible wire format
  return `openai/${litellmModel}`;
}

/**
 * Wait up to `maxWaitMs` for LiteLLM to respond, polling every `pollMs`.
 * Returns true if LiteLLM is reachable, false if timed out.
 */
async function waitForLiteLLM(maxWaitMs = 60_000, pollMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      await litellmListModels();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
  return false;
}

export async function syncModelsToLiteLLM(): Promise<void> {
  if (!isLiteLLMAvailable()) {
    logger.info("[sync] LITELLM_MASTER_KEY not set — skipping model sync");
    return;
  }

  logger.info("[sync] Waiting for LiteLLM to be ready...");
  const ready = await waitForLiteLLM();
  if (!ready) {
    logger.warn("[sync] LiteLLM unreachable after 60s — skipping model sync");
    return;
  }

  // Fetch model names already known to LiteLLM
  let knownNames: Set<string> = new Set();
  try {
    const info = await litellmListModels() as any;
    knownNames = new Set((info.data ?? []).map((m: any) => String(m.model_name)));
  } catch (err) {
    logger.warn({ err }, "[sync] Could not fetch LiteLLM model list, will register all");
  }

  // All enabled models from DB with provider API key
  const models = db
    .prepare(
      `SELECT
         m.name,
         m.litellm_model,
         m.input_cost_per_mtok,
         m.output_cost_per_mtok,
         p.base_url,
         p.type,
         (SELECT key_value FROM provider_api_keys
          WHERE provider_id = p.id
          ORDER BY priority ASC LIMIT 1) AS api_key
       FROM models m
       LEFT JOIN providers p ON m.provider_id = p.id
       WHERE m.enabled = 1`,
    )
    .all() as any[];

  let registered = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of models) {
    if (knownNames.has(m.name)) {
      skipped++;
      continue;
    }

    try {
      await litellmAddModel({
        modelName: m.name,
        litellmParams: {
          // LiteLLM requires "openai/<model>" prefix for custom OpenAI-compatible
          // endpoints. Without it, LiteLLM treats the model as unknown and won't
          // persist or route it correctly.
          model: litellmModelString(m.litellm_model, m.type),
          apiBase: m.base_url ?? undefined,
          apiKey: m.api_key ?? undefined,
          inputCostPerToken:
            m.input_cost_per_mtok != null ? m.input_cost_per_mtok / 1_000_000 : undefined,
          outputCostPerToken:
            m.output_cost_per_mtok != null ? m.output_cost_per_mtok / 1_000_000 : undefined,
        },
      });
      registered++;
    } catch (err) {
      logger.warn({ err, model: m.name }, "[sync] Failed to register model in LiteLLM");
      failed++;
    }
  }

  logger.info({ registered, skipped, failed, total: models.length }, "[sync] Model sync complete");
}
