import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getUserFromToken } from "../lib/auth.js";
import { db } from "../db/index.js";

const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY ?? "";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    qredits: number;
    is_active: number;
    allowed_models: string | null;
    litellm_user_id: string | null;
    created_at: string;
  };
}

/**
 * JWT-only auth middleware. Accepts Bearer <jwt-token>.
 * Used for the management API (/api/*).
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const user = getUserFromToken(token);

  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}

/**
 * Combined JWT + Qillin API key auth middleware.
 * Accepts either:
 *   - Bearer <jwt-token>   — session token from /api/auth/login
 *   - Bearer sk-qillin-…  — API key generated via /api/user/keys
 *
 * Used for the OpenAI-compatible /v1/* endpoints so clients can use
 * either a session token or a long-lived API key.
 *
 * After authentication, sets:
 *   - req.user                               — the authenticated user
 *   - req.headers["x-qillin-litellm-key"]   — LiteLLM key for the proxy
 *   - req.headers["x-user-id"]              — user ID for LiteLLM spend tracking
 */
export function requireApiOrJwtAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  // ── Try JWT auth ──────────────────────────────────────────────────────────
  const jwtUser = getUserFromToken(token);
  if (jwtUser) {
    req.user = jwtUser;
    // For JWT users the proxy falls back to the master key, which bypasses
    // LiteLLM's per-user budgets — so the balance floor must be enforced here.
    if (jwtUser.qredits <= 0) {
      res.status(402).json({
        error: {
          message: "Insufficient Qredits. Ask your administrator to top up your balance.",
          type: "insufficient_quota",
          code: "insufficient_credits",
        },
      });
      return;
    }
    // Reject early if the master key is not configured — an empty Authorization
    // header forwarded to LiteLLM could expose internal routes.
    if (!LITELLM_MASTER_KEY) {
      res.status(503).json({
        error: "AI proxy is not configured (LITELLM_MASTER_KEY missing). Contact your administrator.",
      });
      return;
    }
    req.headers["x-qillin-litellm-key"] = LITELLM_MASTER_KEY;
    req.headers["x-user-id"] = jwtUser.id;
    return next();
  }

  // ── Try API key auth ──────────────────────────────────────────────────────
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const apiKey = db
    .prepare("SELECT user_id, litellm_key FROM api_keys WHERE key_hash = ?")
    .get(hash) as { user_id: string; litellm_key: string | null } | undefined;

  if (apiKey) {
    const user = db
      .prepare(
        "SELECT id, email, name, role, qredits, is_active, allowed_models, litellm_user_id, created_at FROM users WHERE id = ? AND is_active = 1",
      )
      .get(apiKey.user_id) as any;

    if (user) {
      // Balance floor — mirrors the JWT path and covers the master-key
      // fallback below, which bypasses LiteLLM's own budget enforcement.
      if (user.qredits <= 0) {
        res.status(402).json({
          error: {
            message: "Insufficient Qredits. Ask your administrator to top up your balance.",
            type: "insufficient_quota",
            code: "insufficient_credits",
          },
        });
        return;
      }
      req.user = user;
      // Touch last_used (throttled to one write per minute per key so
      // high-volume keys don't turn every request into a DB write).
      db.prepare(
        "UPDATE api_keys SET last_used = datetime('now') WHERE key_hash = ? AND (last_used IS NULL OR last_used < datetime('now', '-60 seconds'))",
      ).run(hash);
      // Use the key's own LiteLLM key if available, otherwise fall back to master key
      req.headers["x-qillin-litellm-key"] = apiKey.litellm_key ?? LITELLM_MASTER_KEY;
      req.headers["x-user-id"] = user.id;
      return next();
    }
  }

  res.status(401).json({ error: "Invalid or expired token" });
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
