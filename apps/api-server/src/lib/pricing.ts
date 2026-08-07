/**
 * Cache-pricing resolution for LiteLLM deployment registration.
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
 *
 * The resolved prices are pushed into every LiteLLM deployment's
 * litellm_params (cache_creation_input_token_cost / cache_read_input_token_cost)
 * at registration time, so LiteLLM's response_cost is the single source of
 * truth for request spend — no spend is ever recomputed locally.
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

export interface CacheCostPerToken {
  cacheWriteCostPerToken: number;
  cacheReadCostPerToken: number;
}

/**
 * Resolve effective cache pricing as per-token costs, ready to push into a
 * LiteLLM deployment's litellm_params (cache_creation_input_token_cost /
 * cache_read_input_token_cost). Pushing these at registration time makes
 * LiteLLM's response_cost authoritative for cached requests too, so Qillin
 * never recomputes spend locally.
 */
export function resolveCacheCostPerToken(baseInputPerMtok: number): CacheCostPerToken {
  const resolved = resolveCachePricing(baseInputPerMtok);
  return {
    cacheWriteCostPerToken: resolved.writePerMtok / 1_000_000,
    cacheReadCostPerToken: resolved.readPerMtok / 1_000_000,
  };
}


