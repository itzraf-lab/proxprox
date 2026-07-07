/**
 * Internal routes called only by LiteLLM (localhost → localhost).
 *
 * POST /api/internal/litellm-event
 *   Receives a success callback from the qillin_callback.py CustomLogger,
 *   inserts into activity_log, and deducts Qredits from the user's balance.
 *
 * Security: validated by the LITELLM_MASTER_KEY bearer token.
 *   These routes must NOT be reached through the public Replit proxy.
 *   In production they are unreachable from the internet because they're
 *   called over the internal loopback interface.
 */
import { Router } from "express";
import { db, uuidv4 } from "../db/index.js";
import { logger } from "../lib/logger.js";

const router = Router();
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY ?? "";

/** Restrict to loopback + validate bearer token. */
function validateInternalKey(req: any, res: any, next: any) {
  // Only accept calls originating from localhost (LiteLLM is co-located).
  // req.socket.remoteAddress covers both ::1 (IPv6 loopback) and 127.0.0.1.
  const remoteAddr = req.socket?.remoteAddress ?? "";
  if (remoteAddr !== "127.0.0.1" && remoteAddr !== "::1" && remoteAddr !== "::ffff:127.0.0.1") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!LITELLM_MASTER_KEY || token !== LITELLM_MASTER_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(validateInternalKey);

/**
 * POST /api/internal/litellm-event
 * Body: { userId, model, tokensIn, tokensOut, spend, latencyMs? }
 */
router.post("/litellm-event", (req, res) => {
  const { userId, model, tokensIn, tokensOut, spend, latencyMs } = req.body ?? {};

  if (!userId || !model) {
    res.status(400).json({ error: "userId and model are required" });
    return;
  }

  const spendAmount = Number(spend) || 0;
  const tokensInN = Number(tokensIn) || 0;
  const tokensOutN = Number(tokensOut) || 0;
  const latencyN = Number(latencyMs) || null;

  // Look up user email for the log record
  const user = db
    .prepare("SELECT email, qredits FROM users WHERE id = ?")
    .get(userId) as { email: string; qredits: number } | undefined;

  if (!user) {
    // User not found — still log it but don't crash
    logger.warn({ userId, model }, "LiteLLM event for unknown user");
    res.json({ ok: true, deducted: false });
    return;
  }

  // Use a transaction so the log insert and credit deduction are atomic.
  // The UPDATE uses MAX(0, qredits - ?) computed in SQL so concurrent events
  // for the same user cannot cause a lost update — each reads the latest value.
  const txn = db.transaction(() => {
    // Insert activity record
    db.prepare(`
      INSERT INTO activity_log (id, type, user_id, user_email, model, tokens_in, tokens_out, spend, latency_ms, timestamp)
      VALUES (?, 'request', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), userId, user.email, model, tokensInN, tokensOutN, spendAmount, latencyN);

    // Atomically deduct Qredits using SQL arithmetic (floor at 0)
    if (spendAmount > 0) {
      db.prepare("UPDATE users SET qredits = MAX(0, qredits - ?), updated_at = datetime('now') WHERE id = ?")
        .run(spendAmount, userId);
    }
  });

  try {
    txn();
    res.json({ ok: true, deducted: spendAmount > 0 });
  } catch (err) {
    logger.error({ err, userId, model }, "Failed to persist LiteLLM event");
    res.status(500).json({ error: "Failed to persist event" });
  }
});

export default router;
