/**
 * Model sync: registers all enabled Qillin DB models into LiteLLM on startup.
 *
 * With the multi-base-URL (cluster) feature each model can have N base URLs,
 * each with M API keys. We register one LiteLLM deployment per (base_url, key)
 * pair for every model so LiteLLM's router handles load-balancing and failover
 * across the full set.
 */
import { db } from "../db/index.js";
import {
  litellmAddModel,
  litellmListModels,
  litellmUpdateUser,
  isLiteLLMAvailable,
} from "./litellm.js";
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
 * the native provider directly.
 */
export function litellmModelString(litellmModel: string, providerType: string): string {
  if (providerType === "anthropic") {
    return litellmModel.startsWith("anthropic/")
      ? litellmModel
      : `anthropic/${litellmModel}`;
  }
  const base = litellmModel.startsWith("openai/")
    ? litellmModel.slice("openai/".length)
    : litellmModel;
  return `openai/${base}`;
}

/**
 * Wait up to `maxWaitMs` for LiteLLM to respond, polling every `pollMs`.
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

interface ModelDeployment {
  name: string;
  litellm_model: string;
  input_cost_per_mtok: number;
  output_cost_per_mtok: number;
  type: string;
  load_balancing: string;
  base_url: string | null;
  url_priority: number;
  key_value: string | null;
  key_priority: number;
}

/**
 * Compute the LiteLLM routing weight for one deployment.
 *
 * Round-robin providers: every deployment gets weight=1 (equal share).
 * Priority providers:
 *   - The lowest-priority tier (smallest url_priority, then smallest
 *     key_priority within that url) gets weight=1 — these are "active".
 *   - All other deployments get weight=0 — "standby". LiteLLM's
 *     simple_shuffle skips weight=0 entries as long as any weight>0
 *     deployment is healthy; they only activate when the entire active
 *     tier has failed into cooldown.
 */
export function computeDeploymentWeight(params: {
  loadBalancing: string;
  urlPriority: number;
  keyPriority: number;
  minUrlPriority: number;
  minKeyPriorityForMinUrl: number;
}): number {
  if (params.loadBalancing !== "priority") return 1;
  const isPrimary =
    params.urlPriority === params.minUrlPriority &&
    params.keyPriority === params.minKeyPriorityForMinUrl;
  return isPrimary ? 1 : 0;
}

/**
 * Collect all (model, base_url, key) triples for enabled models.
 *
 * Uses provider_base_urls + provider_api_keys for the new multi-URL schema.
 * Falls back to the legacy providers.base_url when base_url_id is NULL so
 * that providers migrated before the column was backfilled still work.
 */
function getModelDeployments(): ModelDeployment[] {
  return db.prepare(`
    SELECT
      m.name,
      m.litellm_model,
      m.input_cost_per_mtok,
      m.output_cost_per_mtok,
      p.type,
      p.load_balancing,
      COALESCE(bu.url, p.base_url) AS base_url,
      COALESCE(bu.priority, 0)    AS url_priority,
      k.key_value,
      COALESCE(k.priority, 0)     AS key_priority
    FROM models m
    LEFT JOIN providers p ON m.provider_id = p.id
    LEFT JOIN provider_base_urls bu ON bu.provider_id = p.id
    LEFT JOIN provider_api_keys k ON k.base_url_id = bu.id
    WHERE m.enabled = 1
    ORDER BY m.name, url_priority ASC, key_priority ASC
  `).all() as ModelDeployment[];
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

  // Fetch model names already registered in LiteLLM
  let knownNames: Set<string> = new Set();
  try {
    const info = await litellmListModels() as any;
    knownNames = new Set((info.data ?? []).map((m: any) => String(m.model_name)));
  } catch (err) {
    logger.warn({ err }, "[sync] Could not fetch LiteLLM model list, will register all");
  }

  const deployments = getModelDeployments();

  // Group deployments by model name; skip models already registered in LiteLLM
  const byModel = new Map<string, ModelDeployment[]>();
  for (const d of deployments) {
    if (!byModel.has(d.name)) byModel.set(d.name, []);
    byModel.get(d.name)!.push(d);
  }

  let registered = 0;
  let skipped = 0;
  let failed = 0;

  for (const [modelName, deps] of byModel.entries()) {
    if (knownNames.has(modelName)) {
      skipped++;
      continue;
    }

    // Compute the primary-tier floor for priority providers:
    // lowest url_priority, then lowest key_priority within that url.
    const minUrlPriority = Math.min(...deps.map((d) => d.url_priority));
    const minKeyPriorityForMinUrl = Math.min(
      ...deps.filter((d) => d.url_priority === minUrlPriority).map((d) => d.key_priority),
    );

    // Register every (base_url, key) deployment for this model.
    // LiteLLM treats multiple entries with the same model_name as a pool
    // and load-balances / fails-over across them automatically.
    let modelRegistered = false;
    for (const d of deps) {
      if (!d.key_value) continue; // skip if no key
      const weight = computeDeploymentWeight({
        loadBalancing: d.load_balancing,
        urlPriority: d.url_priority,
        keyPriority: d.key_priority,
        minUrlPriority,
        minKeyPriorityForMinUrl,
      });
      try {
        await litellmAddModel({
          modelName: d.name,
          litellmParams: {
            model: litellmModelString(d.litellm_model, d.type),
            apiBase: d.base_url ?? undefined,
            apiKey: decryptSecret(d.key_value),
            inputCostPerToken:
              d.input_cost_per_mtok != null ? d.input_cost_per_mtok / 1_000_000 : undefined,
            outputCostPerToken:
              d.output_cost_per_mtok != null ? d.output_cost_per_mtok / 1_000_000 : undefined,
            weight,
          },
        });
        modelRegistered = true;
      } catch (err) {
        logger.warn({ err, model: d.name, base_url: d.base_url }, "[sync] Failed to register deployment in LiteLLM");
        failed++;
      }
    }
    if (modelRegistered) registered++;
  }

  logger.info(
    { registered, skipped, failed, totalModels: byModel.size },
    "[sync] Model sync complete"
  );

  await reconcileUserBudgets();
}

/**
 * Push each user's credit ceiling (users.credit_limit) into LiteLLM as
 * `max_budget`.
 */
export async function reconcileUserBudgets(): Promise<void> {
  if (!isLiteLLMAvailable()) return;

  const users = db
    .prepare("SELECT id, credit_limit FROM users")
    .all() as { id: string; credit_limit: number }[];

  let synced = 0;
  let failed = 0;
  for (const u of users) {
    try {
      await litellmUpdateUser({ userId: String(u.id), maxBudget: u.credit_limit });
      synced++;
    } catch (err) {
      logger.debug({ err, userId: u.id }, "[sync] Budget reconcile skipped for user");
      failed++;
    }
  }

  logger.info({ synced, failed, total: users.length }, "[sync] User budget reconcile complete");
}
