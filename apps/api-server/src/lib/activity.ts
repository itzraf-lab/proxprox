/**
 * Shared formatting for per-request prompt-cache usage metrics.
 */

/**
 * Derive the cache metrics for an activity_log row.
 * `cached` distinguishes cache-assisted requests (any cache read or write)
 * from plain ones. Uncached input tokens are derived by subtraction because
 * LiteLLM reports prompt_tokens inclusive of cache tokens.
 */
export function cacheMetrics(r: {
  tokens_in?: number | null;
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
}) {
  const tokensIn = Number(r.tokens_in ?? 0);
  const cacheReadTokens = Number(r.cache_read_tokens ?? 0);
  const cacheWriteTokens = Number(r.cache_write_tokens ?? 0);
  return {
    cached: cacheReadTokens > 0 || cacheWriteTokens > 0,
    cacheReadTokens,
    cacheWriteTokens,
    uncachedTokens: Math.max(0, tokensIn - cacheReadTokens - cacheWriteTokens),
  };
}
