/**
 * Runtime API origin helpers.
 *
 * The OpenAI-compatible endpoint is same-origin in the standard deployment
 * (the web server proxies /v1 to the API server), so examples shown to the
 * user are derived from the browser's current origin — always matching the
 * host the user actually accessed. When the API lives on a different origin,
 * VITE_API_URL takes precedence (mirroring setBaseUrl in main.tsx).
 */
export function getApiBaseUrl(): string {
  const env = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (env) return env;
  return window.location.origin;
}

/** Base URL clients pass to OpenAI-compatible SDKs, e.g. https://host/v1 */
export function getOpenAiBaseUrl(): string {
  return `${getApiBaseUrl()}/v1`;
}
