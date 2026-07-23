/**
 * Cache-pricing resolution and request spend computation.
 *
 * Administrators may configure custom per-million-token prices for prompt-cache
 * write and cache read operations independently (stored in the `settings`
 * table). When a price is NOT set, the system falls back to Anthropic's
 * standard cache pricing percentages applied to the model's base input token
 * price:
 *
 *   - cache write (5-minute ephemeral): 125% of base input price  (1.25 ×)
 *   - cache read:                        10% of base input price  (0.10 ×)
 *
 * Each side (write / read) resolves independently, so an admin can override
 * just one and keep the provider-standard rate for the other.
 */
import { db } from "../db/index.js";

/** Anthropic's standard cache pricing, relative to the base input token price. */
export const DEFAULT_CACHE_WRITE_MULTIPLIER = 1.25;
export const DEFAULT_CACHE_READ_MULTIPLIER = 0.1;

const SETTING_WRITE_KEY = "cache_write_cost_per_mtok";
const SETTING_READ_KEY = "cache_read_cost_per_mtok";

export interface CustomCachePricing {
  cacheWriteCostPerMtok: number | null;
  cacheReadCostPerMtok: number | null;
}

export interface ResolvedCachePricing {
  writePerMtok: number;
  readPerMtok: number;
  writeSource: "custom" | "default";
  readSource: "custom" | "default";
}

function readSetting(key: string): number | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function getCustomCachePricing(): CustomCachePricing {
  return {
    cacheWriteCostPerMtok: readSetting(SETTING_WRITE_KEY),
    cacheReadCostPerMtok: readSetting(SETTING_READ_KEY),
  };
}

export function setCustomCachePricing(pricing: CustomCachePricing): void {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  const remove = db.prepare("DELETE FROM settings WHERE key = ?");

  const txn = db.transaction(() => {
    if (pricing.cacheWriteCostPerMtok == null) remove.run(SETTING_WRITE_KEY);
    else upsert.run(SETTING_WRITE_KEY, String(pricing.cacheWriteCostPerMtok));

    if (pricing.cacheReadCostPerMtok == null) remove.run(SETTING_READ_KEY);
    else upsert.run(SETTING_READ_KEY, String(pricing.cacheReadCostPerMtok));
  });
  txn();
}

/**
 * Resolve the effective cache prices for a model given its base input price.
 * Unset custom prices fall back to Anthropic's standard percentages.
 */
export function resolveCachePricing(baseInputPerMtok: number): ResolvedCachePricing {
  const custom = getCustomCachePricing();
  return {
    writePerMtok: custom.cacheWriteCostPerMtok ?? baseInputPerMtok * DEFAULT_CACHE_WRITE_MULTIPLIER,
    readPerMtok: custom.cacheReadCostPerMtok ?? baseInputPerMtok * DEFAULT_CACHE_READ_MULTIPLIER,
    writeSource: custom.cacheWriteCostPerMtok != null ? "custom" : "default",
    readSource: custom.cacheReadCostPerMtok != null ? "custom" : "default",
  };
}

interface ModelPricingRow {
  input_cost_per_mtok: number;
  output_cost_per_mtok: number;
}

/**
 * Look up a model's configured pricing by the model identifier reported by
 * LiteLLM. Matches the catalog display name, the raw litellm_model value, and
 * provider-prefixed variants ("anthropic/x", "openai/x").
 */
export function findModelPricing(model: string): ModelPricingRow | null {
  const stripped = model.replace(/^(anthropic|openai)\//, "");
  const row = db
    .prepare(
      `SELECT input_cost_per_mtok, output_cost_per_mtok FROM models
       WHERE name = ? OR litellm_model = ? OR name = ? OR litellm_model = ?
       LIMIT 1`,
    )
    .get(model, model, stripped, stripped) as ModelPricingRow | undefined;
  if (!row) return null;
  if (!row.input_cost_per_mtok && !row.output_cost_per_mtok) return null;
  return row;
}

export interface SpendInput {
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string;
}

export interface SpendBreakdown {
  spend: number;
  uncachedTokensIn: number;
  pricing: ResolvedCachePricing;
}

/**
 * Compute request spend from its token breakdown using catalog base prices and
 * the effective cache pricing. Returns null when the model is unknown (caller
 * then falls back to the cost reported by LiteLLM).
 *
 * Note: LiteLLM includes cache tokens in prompt_tokens, so the uncached input
 * is derived by subtraction (floored at 0).
 */
export function computeCachedRequestSpend(input: SpendInput): SpendBreakdown | null {
  const pricing = findModelPricing(input.model);
  if (!pricing) return null;

  const uncachedTokensIn = Math.max(0, input.tokensIn - input.cacheReadTokens - input.cacheWriteTokens);
  const cache = resolveCachePricing(pricing.input_cost_per_mtok);

  const spend =
    (uncachedTokensIn / 1_000_000) * pricing.input_cost_per_mtok +
    (input.cacheWriteTokens / 1_000_000) * cache.writePerMtok +
    (input.cacheReadTokens / 1_000_000) * cache.readPerMtok +
    (input.tokensOut / 1_000_000) * pricing.output_cost_per_mtok;

  return { spend, uncachedTokensIn, pricing: cache };
}
