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
  litellmDeleteModel,
  litellmListModels,
  litellmUpdateUser,
  isLiteLLMAvailable,
} from "./litellm.js";
import { logger } from "./logger.js";
import { decryptSecret } from "./crypto.js";
import { resolveCacheCostPerToken } from "./pricing.js";

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

interface ExistingDeployment {
  id: string;
  modelName: string;
  params: Record<string, unknown>;
}

/**
 * Fetch every deployment currently registered in LiteLLM, grouped by
 * model_name. Returns null when LiteLLM can't be reached.
 */
async function getExistingDeployments(): Promise<Map<string, ExistingDeployment[]> | null> {
  try {
    const info = (await litellmListModels()) as any;
    const byName = new Map<string, ExistingDeployment[]>();
    for (const m of info.data ?? []) {
      const name = String(m.model_name);
      const entry: ExistingDeployment = {
        id: m.model_info?.id,
        modelName: name,
        params: m.litellm_params ?? {},
      };
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name)!.push(entry);
    }
    return byName;
  } catch {
    return null;
  }
}

/** Tolerant float compare for per-token cost params (values ~1e-8..1e-5). */
function costMatches(actual: unknown, expected: number | undefined): boolean {
  const a = typeof actual === "number" && Number.isFinite(actual) ? actual : 0;
  const e = expected ?? 0;
  return Math.abs(a - e) <= Math.max(1e-12, 1e-9 * Math.max(Math.abs(a), Math.abs(e)));
}

/**
 * Expected LiteLLM cost params for a model, derived from the Qillin catalog
 * price and the admin-configured cache pricing. This is what makes LiteLLM's
 * response_cost the single source of truth for spend — including cached
 * requests.
 */
function expectedCostParams(inputCostPerMtok: number | null, outputCostPerMtok: number | null) {
  const inputPerToken = inputCostPerMtok != null ? inputCostPerMtok / 1_000_000 : undefined;
  const outputPerToken = outputCostPerMtok != null ? outputCostPerMtok / 1_000_000 : undefined;
  const cache = resolveCacheCostPerToken(inputCostPerMtok ?? 0);
  return {
    inputCostPerToken: inputPerToken,
    outputCostPerToken: outputPerToken,
    cacheWriteCostPerToken: cache.cacheWriteCostPerToken,
    cacheReadCostPerToken: cache.cacheReadCostPerToken,
  };
}

/**
 * A registered deployment is pricing-stale when any of its cost params
 * differ from what Qillin would push today (covers cache-pricing changes and
 * deployments registered before cache costs were pushed at all).
 */
function isPricingStale(existing: ExistingDeployment[], expected: ReturnType<typeof expectedCostParams>): boolean {
  if (existing.length === 0) return false;
  return existing.some(
    (e) =>
      !costMatches(e.params.input_cost_per_token, expected.inputCostPerToken) ||
      !costMatches(e.params.output_cost_per_token, expected.outputCostPerToken) ||
      !costMatches(e.params.cache_creation_input_token_cost, expected.cacheWriteCostPerToken) ||
      !costMatches(e.params.cache_read_input_token_cost, expected.cacheReadCostPerToken),
  );
}

/**
 * Register every (base_url, key) deployment for one model in LiteLLM with
 * current pricing. Returns the number of deployments successfully added.
 */
async function registerDeploymentsForModel(
  modelName: string,
  deps: ModelDeployment[],
): Promise<{ added: number; failed: number }> {
  const minUrlPriority = Math.min(...deps.map((d) => d.url_priority));
  const minKeyPriorityForMinUrl = Math.min(
    ...deps.filter((d) => d.url_priority === minUrlPriority).map((d) => d.key_priority),
  );

  let added = 0;
  let failed = 0;
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
        modelName,
        litellmParams: {
          model: litellmModelString(d.litellm_model, d.type),
          apiBase: d.base_url ?? undefined,
          apiKey: decryptSecret(d.key_value),
          ...expectedCostParams(d.input_cost_per_mtok, d.output_cost_per_mtok),
          weight,
        },
      });
      added++;
    } catch (err) {
      logger.warn({ err, model: modelName, base_url: d.base_url }, "[sync] Failed to register deployment in LiteLLM");
      failed++;
    }
  }
  return { added, failed };
}

/** Delete every LiteLLM deployment registered under a model_name. */
async function deleteDeploymentsForModel(existing: ExistingDeployment[]): Promise<void> {
  for (const e of existing) {
    if (!e.id) continue;
    await litellmDeleteModel(e.id).catch((err) =>
      logger.warn({ err, model: e.modelName, id: e.id }, "[sync] Failed to delete stale deployment"),
    );
  }
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

  // Fetch deployments already registered in LiteLLM, grouped by model_name.
  const existingByName = await getExistingDeployments();
  if (existingByName === null) {
    logger.warn("[sync] Could not fetch LiteLLM model list, will register all");
  }

  const deployments = getModelDeployments();

  // Group deployments by model name
  const byModel = new Map<string, ModelDeployment[]>();
  for (const d of deployments) {
    if (!byModel.has(d.name)) byModel.set(d.name, []);
    byModel.get(d.name)!.push(d);
  }

  let registered = 0;
  let repriced = 0;
  let skipped = 0;
  let failed = 0;

  for (const [modelName, deps] of byModel.entries()) {
    const existing = existingByName?.get(modelName) ?? [];
    const expected = expectedCostParams(
      deps[0]?.input_cost_per_mtok ?? null,
      deps[0]?.output_cost_per_mtok ?? null,
    );

    if (existingByName !== null && existing.length > 0) {
      // Already registered — only re-register when pricing drifted (e.g.
      // cache pricing changed, or the deployment predates cache-cost push).
      if (!isPricingStale(existing, expected)) {
        skipped++;
        continue;
      }
      await deleteDeploymentsForModel(existing);
      const res = await registerDeploymentsForModel(modelName, deps);
      failed += res.failed;
      if (res.added > 0) repriced++;
      continue;
    }

    const res = await registerDeploymentsForModel(modelName, deps);
    failed += res.failed;
    if (res.added > 0) registered++;
  }

  logger.info(
    { registered, repriced, skipped, failed, totalModels: byModel.size },
    "[sync] Model sync complete"
  );

  await reconcileUserBudgets();
}

/**
 * Force-re-register every enabled model's deployments with current pricing.
 * Called when the admin changes cache pricing so the new rates take effect
 * in LiteLLM immediately (without waiting for a restart).
 */
export async function resyncModelPricingToLiteLLM(): Promise<void> {
  if (!isLiteLLMAvailable()) return;

  const existingByName = await getExistingDeployments();
  if (existingByName === null) {
    logger.warn("[sync] LiteLLM unreachable — cache pricing will apply on next restart");
    return;
  }

  const deployments = getModelDeployments();
  const byModel = new Map<string, ModelDeployment[]>();
  for (const d of deployments) {
    if (!byModel.has(d.name)) byModel.set(d.name, []);
    byModel.get(d.name)!.push(d);
  }

  let repriced = 0;
  let failed = 0;
  for (const [modelName, deps] of byModel.entries()) {
    const existing = existingByName.get(modelName) ?? [];
    if (existing.length > 0) {
      await deleteDeploymentsForModel(existing);
    }
    const res = await registerDeploymentsForModel(modelName, deps);
    failed += res.failed;
    if (res.added > 0) repriced++;
  }

  logger.info({ repriced, failed, totalModels: byModel.size }, "[sync] Model pricing resync complete");
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
