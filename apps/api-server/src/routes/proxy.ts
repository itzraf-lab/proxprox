/**
 * Streaming proxy for /v1/* → LiteLLM
 *
 * Mounted AFTER auth middleware and BEFORE body parsers so the request body
 * is piped raw (no buffering). Supports Server-Sent Events (SSE) streaming
 * for chat completions.
 *
 * Security: only the OpenAI-compatible public endpoints are forwarded.
 * Internal LiteLLM management paths (/key, /user, /health, /model, etc.)
 * are NOT reachable through this proxy.
 *
 * Auth: the requireApiOrJwtAuth middleware (applied in app.ts before this proxy)
 * sets req.headers["x-qillin-litellm-key"] to the correct LiteLLM key.
 * This handler swaps the client's Authorization header with that key before
 * forwarding to LiteLLM.
 */
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Options } from "http-proxy-middleware";
import type { Request, Response } from "express";
import type { IncomingMessage } from "http";

const LITELLM_URL = process.env.LITELLM_URL ?? "http://127.0.0.1:8000";

/** OpenAI-compatible endpoints users are allowed to call */
const ALLOWED_PATHS = new Set([
  "/chat/completions",
  "/completions",
  "/embeddings",
  "/models",
  "/images/generations",
  "/images/edits",
  "/audio/transcriptions",
  "/audio/translations",
  "/audio/speech",
  "/moderations",
  "/rerank",
]);

function onError(err: Error, _req: Request, res: Response) {
  // If the response has already started (e.g. mid-stream failure),
  // we can't write headers — just destroy the connection cleanly.
  if (res.headersSent || res.writableEnded) {
    res.destroy();
    return;
  }
  const code = (err as any).code;
  if (code === "ECONNREFUSED") {
    res.status(503).json({
      error: { message: "AI proxy is starting up, please retry in a moment.", code: "proxy_unavailable" },
    });
  } else if (code === "ETIMEDOUT" || code === "ECONNRESET") {
    res.status(504).json({
      error: { message: "Request to AI provider timed out.", code: "proxy_timeout" },
    });
  } else {
    res.status(502).json({
      error: { message: "AI proxy error.", code: "proxy_error" },
    });
  }
}

const proxyOptions: Options = {
  target: LITELLM_URL,
  changeOrigin: true,
  /**
   * Only proxy paths that exactly match an allowed endpoint or start with one
   * (e.g. /models/gpt-4o is a subpath of /models).
   * Everything else (internal LiteLLM management routes) is rejected.
   * Note: pathname here is relative to the /v1 mount prefix.
   */
  pathFilter: (_pathname, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;
    for (const allowed of ALLOWED_PATHS) {
      if (path === allowed || path.startsWith(allowed + "/")) return true;
    }
    return false;
  },
  // Express strips the /v1 mount prefix before the proxy sees the path.
  // Rewrite the path to restore /v1 so LiteLLM gets the correct URL.
  pathRewrite: { "^/": "/v1/" },
  on: {
    error: onError as any,
    proxyReq: (proxyReq, req: IncomingMessage) => {
      // Strip cookies — LiteLLM doesn't use them
      proxyReq.removeHeader("cookie");

      // Inject the LiteLLM key set by our auth middleware.
      // This replaces whatever the client sent (JWT or Qillin API key) with
      // the correct LiteLLM key so LiteLLM can apply its own budgets/limits.
      const litellmKey = req.headers["x-qillin-litellm-key"];
      if (litellmKey) {
        const key = Array.isArray(litellmKey) ? litellmKey[0] : litellmKey;
        proxyReq.setHeader("authorization", `Bearer ${key}`);
      }
      // Remove our internal header so it doesn't leak to LiteLLM
      proxyReq.removeHeader("x-qillin-litellm-key");

      // x-user-id stays so LiteLLM can track spend per user

      // Tag for tracing in LiteLLM logs
      proxyReq.setHeader("x-forwarded-by", "qillin-proxy");
      // Propagate real client IP
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        req.socket?.remoteAddress ??
        "unknown";
      proxyReq.setHeader("x-real-ip", clientIp);
    },
  },
};

export const litellmProxy = createProxyMiddleware(proxyOptions);
