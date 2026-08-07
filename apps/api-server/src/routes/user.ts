import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { db } from "../db/index.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { litellmGenerateKey, litellmDeleteKey, isLiteLLMAvailable } from "../lib/litellm.js";
import { cacheMetrics } from "../lib/activity.js";

const router = Router();

router.use(requireAuth);

// GET /api/user/usage
router.get("/usage", async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    // Get usage from activity log (request rows only — 'credit_update' entries
    // must not inflate the request count)
    const totalRow = db
      .prepare("SELECT COALESCE(SUM(spend), 0) as total_spend, COUNT(*) as total_requests FROM activity_log WHERE user_id = ? AND type = 'request'")
      .get(userId) as any;

    const modelBreakdown = db
      .prepare(`
        SELECT 
          model as model_id,
          model as model_name,
          COUNT(*) as requests,
          COALESCE(SUM(tokens_in), 0) as tokens_in,
          COALESCE(SUM(tokens_out), 0) as tokens_out,
          COALESCE(SUM(spend), 0) as spend
        FROM activity_log 
        WHERE user_id = ? AND model IS NOT NULL
        GROUP BY model
        ORDER BY spend DESC
        LIMIT 10
      `)
      .all(userId) as any[];

    const recentRequests = db
      .prepare(`
        SELECT id, model, tokens_in as tokens_in, tokens_out as tokens_out, spend,
               cache_read_tokens, cache_write_tokens, timestamp
        FROM activity_log
        WHERE user_id = ? AND type = 'request'
        ORDER BY timestamp DESC
        LIMIT 20
      `)
      .all(userId) as any[];

    res.json({
      totalSpend: totalRow.total_spend,
      totalRequests: Number(totalRow.total_requests),
      modelBreakdown: modelBreakdown.map((m: any) => ({
        modelId: m.model_id ?? "",
        modelName: m.model_name ?? "",
        requests: Number(m.requests),
        tokensIn: Number(m.tokens_in),
        tokensOut: Number(m.tokens_out),
        spend: m.spend,
      })),
      recentRequests: recentRequests.map((r: any) => ({
        id: r.id,
        model: r.model ?? "",
        tokensIn: Number(r.tokens_in ?? 0),
        tokensOut: Number(r.tokens_out ?? 0),
        ...cacheMetrics(r),
        spend: r.spend ?? 0,
        timestamp: r.timestamp,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get usage");
    res.status(500).json({ error: "Failed to get usage" });
  }
});

// GET /api/user/keys
router.get("/keys", (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const keys = db
    .prepare(`
      SELECT id, key_hash, name, spend, last_used, created_at
      FROM api_keys 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `)
    .all(userId) as any[];

  res.json(
    keys.map((k: any) => ({
      keyHash: k.key_hash,
      name: k.name,
      token: null, // Only returned on creation
      createdAt: k.created_at,
      lastUsed: k.last_used ?? null,
      spend: k.spend,
    })),
  );
});

// POST /api/user/keys
router.post("/keys", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { name, maxBudget } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  if (maxBudget != null && (typeof maxBudget !== "number" || !Number.isFinite(maxBudget) || maxBudget < 0)) {
    res.status(400).json({ error: "maxBudget must be a non-negative number" });
    return;
  }

  let litellmKey: string | null = null;
  let keyHash: string;

  if (isLiteLLMAvailable()) {
    try {
      const result = await litellmGenerateKey({
        userId,
        name,
        maxBudget: maxBudget ?? null,
      }) as any;
      if (!result?.key) {
        throw new Error("LiteLLM /key/generate response did not include a key");
      }
      const plainKey: string = result.key;
      litellmKey = plainKey;
      // LiteLLM's `token` is sha256(key) — the same digest requireApiOrJwtAuth
      // computes from the Bearer token. If it's ever absent, derive it the
      // same way; a random fallback would make the key permanently unusable.
      keyHash = result.token ?? crypto.createHash("sha256").update(plainKey).digest("hex");
    } catch (err) {
      req.log.warn({ err }, "LiteLLM key generation failed, creating local key");
      litellmKey = `sk-qillin-${crypto.randomBytes(24).toString("hex")}`;
      keyHash = crypto.createHash("sha256").update(litellmKey).digest("hex");
    }
  } else {
    litellmKey = `sk-qillin-${crypto.randomBytes(24).toString("hex")}`;
    keyHash = crypto.createHash("sha256").update(litellmKey).digest("hex");
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO api_keys (id, user_id, key_hash, name, litellm_key, spend)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, userId, keyHash, name, litellmKey);

  res.status(201).json({
    keyHash,
    name,
    token: litellmKey, // Only returned once
    createdAt: new Date().toISOString(),
    lastUsed: null,
    spend: 0,
  });
});

// GET /api/user/requests — paginated request history
router.get("/requests", (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const model = req.query.model ? String(req.query.model) : null;

  const whereModel = model ? " AND model = ?" : "";
  const baseParams: any[] = [userId];
  if (model) baseParams.push(model);

  try {
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM activity_log WHERE user_id = ? AND type = 'request'${whereModel}`)
        .get(...baseParams) as any
    ).c;

    const rows = db.prepare(`
      SELECT id, model, tokens_in, tokens_out, spend, latency_ms,
             cache_read_tokens, cache_write_tokens, timestamp
      FROM activity_log
      WHERE user_id = ? AND type = 'request'${whereModel}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...baseParams, limit, offset) as any[];

    res.json({
      items: rows.map((r: any) => ({
        id: r.id,
        model: r.model ?? "",
        tokensIn: Number(r.tokens_in ?? 0),
        tokensOut: Number(r.tokens_out ?? 0),
        ...cacheMetrics(r),
        spend: r.spend ?? 0,
        latencyMs: r.latency_ms ?? null,
        timestamp: r.timestamp,
      })),
      total: Number(total),
      page,
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user requests");
    res.status(500).json({ error: "Failed to get requests" });
  }
});

// DELETE /api/user/keys/:keyHash
router.delete("/keys/:keyHash", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { keyHash } = req.params;

  const key = db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ? AND user_id = ?")
    .get(keyHash, userId) as any;

  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  if (isLiteLLMAvailable() && key.litellm_key) {
    litellmDeleteKey(key.litellm_key).catch((err) =>
      req.log.warn({ err }, "Failed to delete LiteLLM key"),
    );
  }

  db.prepare("DELETE FROM api_keys WHERE key_hash = ? AND user_id = ?").run(keyHash, userId);

  res.json({ message: "Key deleted" });
});

export default router;
