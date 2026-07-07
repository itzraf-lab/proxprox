/**
 * Streaming proxy for /v1/* → LiteLLM
 *
 * Mounted BEFORE body parsers so the request body is piped raw (no buffering).
 * Supports Server-Sent Events (SSE) streaming for chat completions.
 *
 * Security: only the OpenAI-compatible public endpoints are forwarded.
 * Internal LiteLLM management paths (/key, /user, /health, /model, etc.)
 * are NOT reachable through this proxy.
 */
import { createProxyMiddleware, type Filter, type Options } from "http-proxy-middleware";
import type { Request, Response } from "express";

const LITELLM_URL = process.env.LITELLM_URL ?? "http://localhost:8000";

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

/**
 * Filter function: only proxy paths that exactly match an allowed endpoint or
 * start with one (e.g. /models/gpt-4o is a subpath of /models).
 * Everything else (internal LiteLLM management routes) is rejected.
 */
const pathFilter: Filter = (_pathname, req) => {
  // pathname here is what Express sees AFTER stripping the mount prefix (/v1).
  // We need to check the original URL instead.
  const url = new URL(req.url ?? "/", "http://x");
  const path = url.pathname;
  for (const allowed of ALLOWED_PATHS) {
    if (path === allowed || path.startsWith(allowed + "/")) return true;
  }
  return false;
};

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
  // Don't decompress — pass SSE / compressed streams through as-is
  compress: false,
  // Express strips the /v1 mount prefix before the proxy sees the path.
  // Rewrite the path to restore /v1 so LiteLLM gets the correct URL.
  pathRewrite: { "^/": "/v1/" },
  on: {
    error: onError,
    proxyReq: (proxyReq, req) => {
      // Strip cookies — LiteLLM doesn't use them
      proxyReq.removeHeader("cookie");
      // Tag for tracing in LiteLLM logs
      proxyReq.setHeader("x-forwarded-by", "qillin-proxy");
      // Propagate real client IP
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        req.socket.remoteAddress ??
        "unknown";
      proxyReq.setHeader("x-real-ip", clientIp);
    },
  },
};

export const litellmProxy = createProxyMiddleware({ ...proxyOptions, filter: pathFilter });
