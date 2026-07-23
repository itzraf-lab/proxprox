/**
 * Prompt-cache middleware for POST /v1/chat/completions.
 *
 * The /v1 stack deliberately avoids body parsing so requests can be piped raw
 * to LiteLLM. This middleware is the single exception: it buffers and parses
 * the (comparatively small) JSON request body of chat completions ONLY, so the
 * optional `cacheAtDepth` parameter can be expanded into a `cache_control`
 * block before the streaming proxy forwards the request.
 *
 * The proxy (routes/proxy.ts) re-serializes req.body via fixRequestBody() when
 * `qillinBodyParsed` is set — request streaming to LiteLLM is unaffected, and
 * response streaming (SSE) works exactly as before.
 *
 * Manual caching is untouched: messages that already carry user-defined
 * `cache_control` blocks are passed through verbatim, and both mechanisms
 * function concurrently (see lib/prompt-cache.ts).
 */
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { transformChatCompletionsBody } from "../lib/prompt-cache.js";

const jsonParser = express.json({ limit: "10mb" });

/** Marker consumed by the streaming proxy to decide whether to re-write the body. */
export const BODY_PARSED_FLAG = "qillinBodyParsed";

export function promptCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  // Mounted at /v1 — req.path is relative to the mount point.
  if (req.method !== "POST" || req.path !== "/chat/completions") {
    next();
    return;
  }

  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.includes("application/json")) {
    // Not a JSON request: leave the raw stream alone (proxy pipes it as-is).
    next();
    return;
  }

  jsonParser(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({
        error: { message: "Invalid JSON request body.", code: "invalid_body" },
      });
      return;
    }

    try {
      transformChatCompletionsBody((req as any).body);
      // Always flag parsed bodies so the proxy re-serializes them — the raw
      // stream has been consumed by the JSON parser.
      (req as any)[BODY_PARSED_FLAG] = true;
      next();
    } catch (transformErr) {
      next(transformErr);
    }
  });
}
