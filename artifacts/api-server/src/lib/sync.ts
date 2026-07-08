/**
 * Model sync: registers all enabled Qillin DB models into LiteLLM on startup.
 *
 * Models added to Qillin while LiteLLM was down are not registered there,
 * so chat completions fail with "Invalid model name". This sync fixes the gap.
 */
import { db } from "../db/index.js";
import { litellmAddModel, litellmListModels, isLiteLLMAvailable } from "./litellm.js";
import { logger } from "./logger.js";
import { decryptSecret } from "./crypto.js";

/**
 * Build the litellm_params.model string for a given provider type.
 *
 * LiteLLM's routing is driven by the model-string prefix:
 *   - "anthropic/<model>" → routes to native Anthropic API (ignores api_base)
 *   - "openai/<model>"   → uses OpenAI-compatible wire format with the given api_base
 *
 * For CUSTOM providers (e.g. OpenRouter, Crimson) we MUST always use the
 * "openai/" prefix — even when the model name itself starts with "anthropic/"
 * or "openai/". Without it, LiteLLM bypasses the custom api_base and hits
 * the native provider directly (using the OpenRouter key against Anthropic,
 * which returns an HTML error page).
 *
 * The model name stored after stripping the "openai/" prefix is forwarded
 * verbatim as the "model" field in the upstream request, so OpenRouter
 * receives e.g. "anthropic/claude-sonnet-4" exactly as it expects.
 */
export function litellmModelString(litellmModel: string, providerType: string): string {
  if (providerType === "anthropic") {
    // Native Anthropic provider: use "anthropic/" prefix (no api_base involved)
    return litellmModel.startsWith("anthropic/")
      ? litellmModel
      : `anthropic/${litellmModel}`;
  }
  // Custom / OpenAI-compatible providers: always wrap with "openai/" so
  // LiteLLM honours the custom api_base for ALL model names.
  // Strip any existing "openai/" prefix first to avoid double-prefixing
  // if the stored litellm_model already starts with "openai/".
  const base = litellmModel.startsWith("openai/")
    ? litellmModel.slice("openai/".length)
    : litellmModel;
  return `openai/${base}`;
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
          apiKey: m.api_key ? decryptSecret(m.api_key) : undefined,
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
