import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { requireAdmin, type AuthRequest } from "../middlewares/requireAuth.js";
import {
  litellmUpdateUser,
  litellmAddModel,
  litellmDeleteModel,
  litellmListModels,
  isLiteLLMAvailable,
  fetchModelsFromProvider,
} from "../lib/litellm.js";
import { syncModelsToLiteLLM, litellmModelString, computeDeploymentWeight } from "../lib/sync.js";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";

const router = Router();
router.use(requireAdmin);

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAllowedModels(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return raw.split(",").map((s: string) => s.trim()).filter(Boolean);
  }
}

function resolveModelNames(raw: string[] | null): string[] | null {
  if (!raw) return null;
  return raw.map((id) => {
    const byName = db.prepare("SELECT name FROM models WHERE name = ? LIMIT 1").get(id) as any;
    if (byName) return byName.name;
    const byTarget = db.prepare("SELECT name FROM models WHERE litellm_model = ? LIMIT 1").get(id) as any;
    return byTarget?.name ?? id;
  });
}

function userTotalSpend(userId: string): number {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(spend), 0) as s FROM activity_log WHERE user_id = ? AND type = 'request'",
    )
    .get(userId) as { s: number };
  return row.s;
}

function formatAdminUser(u: any): object {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    qredits: u.qredits,
    creditLimit: u.credit_limit ?? 0,
    totalSpend: u.total_spend ?? 0,
    totalRequests: Number(u.total_requests ?? 0),
    allowedModels: parseAllowedModels(u.allowed_models),
    isActive: u.is_active === 1,
    createdAt: u.created_at,
    litellmUserId: u.litellm_user_id ?? null,
  };
}

function maskKey(storedKey: string): string {
  const key = decryptSecret(storedKey);
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

/**
 * Format a provider with its full base-URL/key hierarchy.
 *
 * Each provider_base_urls row is returned in priority order, with its
 * associated provider_api_keys nested inside (also in priority order).
 */
function formatProvider(p: any, modelCount: number) {
  const baseUrlRows = db
    .prepare("SELECT * FROM provider_base_urls WHERE provider_id = ? ORDER BY priority ASC")
    .all(p.id) as any[];

  const baseUrls = baseUrlRows.map((bu: any) => {
    const keys = db
      .prepare("SELECT * FROM provider_api_keys WHERE base_url_id = ? ORDER BY priority ASC")
      .all(bu.id) as any[];
    return {
      id: bu.id,
      url: bu.url ?? null,
      priority: bu.priority,
      keys: keys.map((k: any) => ({
        id: k.id,
        label: k.label ?? null,
        keyMasked: maskKey(k.key_value),
        priority: k.priority,
        failCount: k.fail_count,
      })),
    };
  });

  return {
    id: p.id,
    name: p.name,
    type: p.type,
    loadBalancing: p.load_balancing,
    baseUrls,
    modelCount,
    isActive: p.is_active === 1,
    createdAt: p.created_at,
  };
}

function formatModel(m: any, providerName: string) {
  return {
    id: m.id,
    name: m.name,
    litellmModel: m.litellm_model,
    provider: providerName,
    providerId: m.provider_id,
    contextWindow: m.context_window,
    inputCostPerMtok: m.input_cost_per_mtok,
    outputCostPerMtok: m.output_cost_per_mtok,
    enabled: m.enabled === 1,
  };
}

// ── LiteLLM model re-sync ─────────────────────────────────────────────────────

router.post("/sync-models", async (req: AuthRequest, res) => {
  if (!isLiteLLMAvailable()) {
    res.status(503).json({ error: "LiteLLM is not configured" });
    return;
  }
  syncModelsToLiteLLM().catch((err) =>
    req.log.error({ err }, "Manual model sync failed"),
  );
  res.json({ message: "Model sync started" });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get("/stats", (_req, res) => {
  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'user'").get() as any).c;
  const totalSpend = (db.prepare("SELECT COALESCE(SUM(spend), 0) as s FROM activity_log").get() as any).s;
  const totalRequests = (db.prepare("SELECT COUNT(*) as c FROM activity_log WHERE type = 'request'").get() as any).c;
  const activeModels = (db.prepare("SELECT COUNT(*) as c FROM models WHERE enabled = 1").get() as any).c;
  const activeProviders = (db.prepare("SELECT COUNT(*) as c FROM providers WHERE is_active = 1").get() as any).c;

  const spendByDay = db.prepare(`
    SELECT 
      date(timestamp) as date,
      COALESCE(SUM(spend), 0) as spend,
      COUNT(*) as requests
    FROM activity_log
    WHERE timestamp >= date('now', '-14 days')
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).all() as any[];

  const days: { date: string; spend: number; requests: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const found = spendByDay.find((r: any) => r.date === dateStr);
    days.push({ date: dateStr, spend: found?.spend ?? 0, requests: Number(found?.requests ?? 0) });
  }

  const topUsers = db.prepare(`
    SELECT 
      u.id as user_id,
      u.email,
      u.name,
      COALESCE(SUM(a.spend), 0) as spend,
      COUNT(a.id) as requests
    FROM users u
    LEFT JOIN activity_log a ON u.id = a.user_id
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY spend DESC
    LIMIT 5
  `).all() as any[];

  res.json({
    totalUsers: Number(totalUsers),
    totalSpend,
    totalRequests: Number(totalRequests),
    activeModels: Number(activeModels),
    activeProviders: Number(activeProviders),
    spendByDay: days,
    topUsers: topUsers.map((u: any) => ({
      userId: u.user_id,
      email: u.email,
      name: u.name,
      spend: u.spend,
      requests: Number(u.requests),
    })),
  });
});

// GET /api/admin/activity
router.get("/activity", (_req, res) => {
  const records = db
    .prepare(`SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 50`)
    .all() as any[];

  res.json(
    records.map((r: any) => ({
      id: r.id,
      type: r.type,
      userId: r.user_id ?? null,
      userEmail: r.user_email ?? null,
      model: r.model ?? null,
      tokensIn: r.tokens_in ?? null,
      tokensOut: r.tokens_out ?? null,
      spend: r.spend ?? null,
      timestamp: r.timestamp,
    })),
  );
});

// GET /api/admin/requests — paginated request history (all users)
router.get("/requests", (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;
  const userId = req.query.userId ? String(req.query.userId) : null;
  const model = req.query.model ? String(req.query.model) : null;

  const conditions: string[] = ["type = 'request'"];
  const params: any[] = [];
  if (userId) { conditions.push("user_id = ?"); params.push(userId); }
  if (model) { conditions.push("model = ?"); params.push(model); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  try {
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM activity_log ${where}`)
        .get(...params) as any
    ).c;

    const rows = db.prepare(`
      SELECT id, user_id, user_email, model, tokens_in, tokens_out, spend, latency_ms, timestamp
      FROM activity_log ${where}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    res.json({
      items: rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id ?? null,
        userEmail: r.user_email ?? null,
        model: r.model ?? "",
        tokensIn: Number(r.tokens_in ?? 0),
        tokensOut: Number(r.tokens_out ?? 0),
        spend: r.spend ?? 0,
        latencyMs: r.latency_ms ?? null,
        timestamp: r.timestamp,
      })),
      total: Number(total),
      page,
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin requests");
    res.status(500).json({ error: "Failed to get requests" });
  }
});

// GET /api/admin/model-utilization
router.get("/model-utilization", (_req, res) => {
  const rows = db.prepare(`
    SELECT
      model as model_id,
      model as model_name,
      COUNT(*) as requests,
      COALESCE(SUM(tokens_in), 0) as tokens_in,
      COALESCE(SUM(tokens_out), 0) as tokens_out,
      COALESCE(SUM(spend), 0) as spend
    FROM activity_log
    WHERE type = 'request' AND model IS NOT NULL
    GROUP BY model
    ORDER BY spend DESC
  `).all() as any[];

  res.json(rows.map((r: any) => ({
    modelId: r.model_id ?? "",
    modelName: r.model_name ?? "",
    requests: Number(r.requests),
    tokensIn: Number(r.tokens_in),
    tokensOut: Number(r.tokens_out),
    spend: r.spend,
  })));
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/users", (_req, res) => {
  const users = db.prepare(`
    SELECT 
      u.*,
      COALESCE(SUM(a.spend), 0) as total_spend,
      COUNT(a.id) as total_requests
    FROM users u
    LEFT JOIN activity_log a ON u.id = a.user_id AND a.type = 'request'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all() as any[];

  res.json(users.map(formatAdminUser));
});

router.get("/users/:userId", (req, res) => {
  const user = db.prepare(`
    SELECT 
      u.*,
      COALESCE(SUM(a.spend), 0) as total_spend,
      COUNT(a.id) as total_requests
    FROM users u
    LEFT JOIN activity_log a ON u.id = a.user_id AND a.type = 'request'
    WHERE u.id = ?
    GROUP BY u.id
  `).get(req.params.userId) as any;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatAdminUser(user));
});

router.patch("/users/:userId", async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { qredits, isActive, allowedModels, role } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];

  let newCreditLimit: number | null = null;
  if (qredits != null) {
    newCreditLimit = userTotalSpend(String(userId)) + qredits;
    updates.push("qredits = ?", "credit_limit = ?");
    params.push(qredits, newCreditLimit);
  }
  if (isActive != null) {
    updates.push("is_active = ?");
    params.push(isActive ? 1 : 0);
  }
  if (allowedModels !== undefined && allowedModels !== null) {
    if (!Array.isArray(allowedModels) || allowedModels.some((m: any) => typeof m !== "string")) {
      res.status(400).json({ error: "allowedModels must be null or an array of strings" });
      return;
    }
  }

  const resolvedModels = allowedModels !== undefined
    ? resolveModelNames(allowedModels)
    : undefined;

  if (resolvedModels !== undefined) {
    updates.push("allowed_models = ?");
    params.push(resolvedModels ? JSON.stringify(resolvedModels) : null);
  }
  if (role != null) {
    if (role !== "user" && role !== "admin") {
      res.status(400).json({ error: "role must be 'user' or 'admin'" });
      return;
    }
    updates.push("role = ?");
    params.push(role);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(userId);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  if (isLiteLLMAvailable() && (qredits != null || resolvedModels !== undefined)) {
    litellmUpdateUser({
      userId: String(userId),
      ...(newCreditLimit != null ? { maxBudget: newCreditLimit } : {}),
      ...(resolvedModels !== undefined ? { allowedModels: resolvedModels } : {}),
    }).catch((err: any) => req.log.warn({ err }, "LiteLLM user update failed"));
  }

  const updated = db.prepare(`
    SELECT u.*, COALESCE(SUM(a.spend), 0) as total_spend, COUNT(a.id) as total_requests
    FROM users u LEFT JOIN activity_log a ON u.id = a.user_id AND a.type = 'request'
    WHERE u.id = ? GROUP BY u.id
  `).get(userId) as any;

  res.json(formatAdminUser(updated));
});

// POST /api/admin/users/:userId/credits
router.post("/users/:userId/credits", async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { amount, operation } = req.body;

  if (amount == null || !operation) {
    res.status(400).json({ error: "amount and operation are required" });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let newQredits: number;
  switch (operation) {
    case "add":
      newQredits = user.qredits + amount;
      break;
    case "subtract":
      newQredits = Math.max(0, user.qredits - amount);
      break;
    case "set":
      newQredits = amount;
      break;
    default:
      res.status(400).json({ error: "operation must be add, subtract, or set" });
      return;
  }

  const newCreditLimit = userTotalSpend(String(userId)) + newQredits;

  db.prepare("UPDATE users SET qredits = ?, credit_limit = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newQredits, newCreditLimit, userId);

  if (isLiteLLMAvailable()) {
    litellmUpdateUser({ userId: String(userId), maxBudget: newCreditLimit }).catch((err: any) =>
      req.log.warn({ err }, "LiteLLM budget update failed"),
    );
  }

  db.prepare(`
    INSERT INTO activity_log (id, type, user_id, user_email, timestamp)
    VALUES (?, 'credit_update', ?, ?, datetime('now'))
  `).run(uuidv4(), userId, user.email);

  const updated = db.prepare(`
    SELECT u.*, COALESCE(SUM(a.spend), 0) as total_spend, COUNT(a.id) as total_requests
    FROM users u LEFT JOIN activity_log a ON u.id = a.user_id AND a.type = 'request'
    WHERE u.id = ? GROUP BY u.id
  `).get(userId) as any;

  res.json(formatAdminUser(updated));
});

// ── Provider connection test ──────────────────────────────────────────────────

router.post("/providers/test-connection", async (req: AuthRequest, res) => {
  const { type, baseUrl, apiKey } = req.body;

  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }

  if (type === "custom" && baseUrl) {
    const check = validateProviderUrl(baseUrl);
    if (!check.ok) {
      res.status(400).json({ error: `Invalid provider URL: ${check.reason}` });
      return;
    }
  }

  try {
    const models = await fetchModelsFromProvider({ type: type ?? "custom", baseUrl, apiKey });
    res.json(models);
  } catch (err: any) {
    req.log.warn({ err }, "test-connection failed");
    res.status(400).json({ error: err.message ?? "Failed to connect to provider" });
  }
});

// ── Providers ─────────────────────────────────────────────────────────────────

router.get("/providers", (_req, res) => {
  const providers = db.prepare("SELECT * FROM providers ORDER BY created_at DESC").all() as any[];

  const result = providers.map((p: any) => {
    const modelCount = (db.prepare("SELECT COUNT(*) as c FROM models WHERE provider_id = ?").get(p.id) as any).c;
    return formatProvider(p, Number(modelCount));
  });

  res.json(result);
});

/**
 * POST /api/admin/providers
 *
 * Body: {
 *   name, type, loadBalancing,
 *   baseUrls: [{ url, priority, keys: [{ key, label, priority }] }],
 *   models: [...]   // optional — auto-created models from connection test
 * }
 */
router.post("/providers", async (req: AuthRequest, res) => {
  const { name, type, loadBalancing, baseUrls, models } = req.body;

  if (!name || !type || !loadBalancing) {
    res.status(400).json({ error: "name, type, and loadBalancing are required" });
    return;
  }
  if (!Array.isArray(baseUrls) || baseUrls.length === 0) {
    res.status(400).json({ error: "baseUrls must be a non-empty array" });
    return;
  }

  // Validate all base URLs for custom providers
  for (const bu of baseUrls) {
    if (type === "custom" && !bu.url) {
      res.status(400).json({ error: "url is required for each base URL entry in custom providers" });
      return;
    }
    if (bu.url) {
      const check = validateProviderUrl(bu.url);
      if (!check.ok) {
        res.status(400).json({ error: `Invalid provider URL "${bu.url}": ${check.reason}` });
        return;
      }
    }
  }

  const providerId = uuidv4();

  // Derive a legacy base_url (first entry) for backward compat columns
  const legacyBaseUrl = baseUrls[0]?.url ?? null;

  db.prepare(`
    INSERT INTO providers (id, name, type, base_url, load_balancing, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(providerId, name, type, legacyBaseUrl, loadBalancing);

  // Insert base URLs and their keys
  const firstBuPrimaryKey: string | undefined = (() => {
    let first: string | undefined;
    for (const bu of baseUrls) {
      const buId = uuidv4();
      db.prepare(`
        INSERT INTO provider_base_urls (id, provider_id, url, priority)
        VALUES (?, ?, ?, ?)
      `).run(buId, providerId, bu.url ?? null, bu.priority ?? 0);

      if (Array.isArray(bu.keys)) {
        for (const k of bu.keys) {
          db.prepare(`
            INSERT INTO provider_api_keys (id, provider_id, base_url_id, key_value, label, priority, fail_count)
            VALUES (?, ?, ?, ?, ?, ?, 0)
          `).run(uuidv4(), providerId, buId, encryptSecret(k.key), k.label ?? null, k.priority ?? 0);
          if (first === undefined) first = k.key; // plain key (not encrypted) for LiteLLM
        }
      }
    }
    return first;
  })();

  // Auto-create selected models and register all deployments in LiteLLM
  if (Array.isArray(models) && models.length > 0) {
    for (const m of models) {
      if (!m.id) continue;
      const modelId = uuidv4();
      db.prepare(`
        INSERT INTO models (id, name, litellm_model, provider_id, context_window, input_cost_per_mtok, output_cost_per_mtok, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        modelId, m.id, m.id, providerId,
        m.contextWindow ?? 4096,
        m.inputCostPerMtok ?? 0,
        m.outputCostPerMtok ?? 0,
      );

      if (isLiteLLMAvailable()) {
        // Register one LiteLLM deployment per (base_url, key) for this model
        await registerModelDeployments(
          { name: m.id, litellm_model: m.id, type, input_cost_per_mtok: m.inputCostPerMtok ?? 0, output_cost_per_mtok: m.outputCostPerMtok ?? 0 },
          baseUrls,
          loadBalancing,
          req,
        );
      }
    }
  }

  const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(providerId) as any;
  const modelCount = (db.prepare("SELECT COUNT(*) as c FROM models WHERE provider_id = ?").get(providerId) as any).c;
  res.status(201).json(formatProvider(provider, Number(modelCount)));
});

/**
 * PUT /api/admin/providers/:providerId
 * Replaces the provider's base URLs and keys entirely.
 */
router.put("/providers/:providerId", (req, res) => {
  const { providerId } = req.params;
  const { name, type, loadBalancing, baseUrls } = req.body;

  const existing = db.prepare("SELECT * FROM providers WHERE id = ?").get(providerId);
  if (!existing) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  if (Array.isArray(baseUrls)) {
    for (const bu of baseUrls) {
      if (type === "custom" && !bu.url) {
        res.status(400).json({ error: "url is required for each base URL entry in custom providers" });
        return;
      }
      if (bu.url) {
        const check = validateProviderUrl(bu.url);
        if (!check.ok) {
          res.status(400).json({ error: `Invalid provider URL "${bu.url}": ${check.reason}` });
          return;
        }
      }
    }
  }

  const legacyBaseUrl = Array.isArray(baseUrls) && baseUrls.length > 0
    ? (baseUrls[0]?.url ?? null)
    : (existing as any).base_url;

  db.prepare(`
    UPDATE providers SET name = ?, type = ?, base_url = ?, load_balancing = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, type, legacyBaseUrl, loadBalancing, providerId);

  // Replace all base URLs and keys if provided
  if (Array.isArray(baseUrls)) {
    // Cascade delete handled by FK — deleting provider_base_urls removes their keys
    db.prepare("DELETE FROM provider_base_urls WHERE provider_id = ?").run(providerId);

    for (const bu of baseUrls) {
      const buId = uuidv4();
      db.prepare(`
        INSERT INTO provider_base_urls (id, provider_id, url, priority)
        VALUES (?, ?, ?, ?)
      `).run(buId, providerId, bu.url ?? null, bu.priority ?? 0);

      if (Array.isArray(bu.keys)) {
        for (const k of bu.keys) {
          db.prepare(`
            INSERT INTO provider_api_keys (id, provider_id, base_url_id, key_value, label, priority, fail_count)
            VALUES (?, ?, ?, ?, ?, ?, 0)
          `).run(uuidv4(), providerId, buId, encryptSecret(k.key), k.label ?? null, k.priority ?? 0);
        }
      }
    }
  }

  const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(providerId) as any;
  const modelCount = (db.prepare("SELECT COUNT(*) as c FROM models WHERE provider_id = ?").get(providerId) as any).c;
  res.json(formatProvider(provider, Number(modelCount)));
});

router.delete("/providers/:providerId", (_req, res) => {
  const { providerId } = _req.params;
  const existing = db.prepare("SELECT id FROM providers WHERE id = ?").get(providerId);
  if (!existing) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  db.prepare("DELETE FROM providers WHERE id = ?").run(providerId);
  res.json({ message: "Provider deleted" });
});

// Validate that a URL is safe to fetch (no SSRF)
function validateProviderUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL format" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, reason: "Only http and https URLs are allowed" };
  }
  const host = parsed.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
    /^0\./,
  ];
  for (const re of privatePatterns) {
    if (re.test(host)) {
      return { ok: false, reason: "URL resolves to a private or internal address" };
    }
  }
  return { ok: true, url: parsed };
}

/**
 * Register all (base_url, key) deployments for a model in LiteLLM.
 * LiteLLM treats entries with the same model_name as a pool and
 * load-balances/fails-over across them automatically.
 *
 * For priority providers, deployments outside the primary tier receive
 * weight=0 so they act as standby — only selected by LiteLLM when every
 * weight>0 deployment for the model is in cooldown (i.e. has failed out).
 */
async function registerModelDeployments(
  model: { name: string; litellm_model: string; type: string; input_cost_per_mtok: number; output_cost_per_mtok: number },
  baseUrls: Array<{ url?: string | null; priority?: number; keys: Array<{ key: string; priority?: number }> }>,
  loadBalancing: string,
  req: AuthRequest,
) {
  // Compute the primary-tier floor for priority routing.
  const allPairs = baseUrls.flatMap((bu) =>
    (bu.keys ?? []).map((k) => ({ urlPriority: bu.priority ?? 1, keyPriority: k.priority ?? 1 })),
  );
  const minUrlPriority = allPairs.length ? Math.min(...allPairs.map((p) => p.urlPriority)) : 1;
  const minKeyPriorityForMinUrl = allPairs.length
    ? Math.min(...allPairs.filter((p) => p.urlPriority === minUrlPriority).map((p) => p.keyPriority))
    : 1;

  for (const bu of baseUrls) {
    for (const k of bu.keys ?? []) {
      if (!k.key) continue;
      const weight = computeDeploymentWeight({
        loadBalancing,
        urlPriority: bu.priority ?? 1,
        keyPriority: k.priority ?? 1,
        minUrlPriority,
        minKeyPriorityForMinUrl,
      });
      litellmAddModel({
        modelName: model.name,
        litellmParams: {
          model: litellmModelString(model.litellm_model, model.type),
          apiBase: bu.url ?? undefined,
          apiKey: k.key,
          inputCostPerToken: model.input_cost_per_mtok != null ? model.input_cost_per_mtok / 1_000_000 : undefined,
          outputCostPerToken: model.output_cost_per_mtok != null ? model.output_cost_per_mtok / 1_000_000 : undefined,
          weight,
        },
      }).catch((err: any) => req.log?.warn({ err, model: model.name }, "LiteLLM model add failed"));
    }
  }
}

// POST /api/admin/providers/:providerId/fetch-models
router.post("/providers/:providerId/fetch-models", async (req: AuthRequest, res) => {
  const { providerId } = req.params;
  const { apiKey, baseUrl } = req.body;

  const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(providerId) as any;
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }

  const resolvedBaseUrl: string | undefined = baseUrl ?? provider.base_url ?? undefined;
  if (provider.type === "custom" && resolvedBaseUrl) {
    const check = validateProviderUrl(resolvedBaseUrl);
    if (!check.ok) {
      res.status(400).json({ error: `Invalid provider URL: ${check.reason}` });
      return;
    }
  }

  try {
    const models = await fetchModelsFromProvider({
      type: provider.type,
      baseUrl: resolvedBaseUrl,
      apiKey,
    });
    res.json(models);
  } catch (err: any) {
    req.log.warn({ err }, "Failed to fetch provider models");
    res.status(400).json({ error: err.message ?? "Failed to fetch models from provider" });
  }
});

// ── Models ────────────────────────────────────────────────────────────────────

router.get("/models", (_req, res) => {
  const models = db.prepare(`
    SELECT m.*, p.name as provider_name
    FROM models m
    LEFT JOIN providers p ON m.provider_id = p.id
    ORDER BY m.name ASC
  `).all() as any[];

  res.json(models.map((m: any) => formatModel(m, m.provider_name)));
});

router.post("/models", async (req: AuthRequest, res) => {
  const { name, litellmModel, providerId, contextWindow, inputCostPerMtok, outputCostPerMtok, enabled } = req.body;

  if (!name || !litellmModel || !providerId) {
    res.status(400).json({ error: "name, litellmModel, and providerId are required" });
    return;
  }

  const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(providerId) as any;
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  const id = uuidv4();
  const isEnabled = enabled !== false ? 1 : 0;

  db.prepare(`
    INSERT INTO models (id, name, litellm_model, provider_id, context_window, input_cost_per_mtok, output_cost_per_mtok, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, litellmModel, providerId, contextWindow ?? 4096, inputCostPerMtok ?? 0, outputCostPerMtok ?? 0, isEnabled);

  // Sync all (base_url, key) deployments to LiteLLM
  if (isLiteLLMAvailable() && isEnabled) {
    const baseUrlRows = db.prepare("SELECT * FROM provider_base_urls WHERE provider_id = ? ORDER BY priority ASC").all(providerId) as any[];
    // Compute primary-tier floor for weight assignment
    const allPairsPost = baseUrlRows.flatMap((bu: any) => {
      const keys = db.prepare("SELECT * FROM provider_api_keys WHERE base_url_id = ? ORDER BY priority ASC").all(bu.id) as any[];
      return keys.map((k: any) => ({ urlPriority: bu.priority ?? 1, keyPriority: k.priority ?? 1 }));
    });
    const minUrlPost = allPairsPost.length ? Math.min(...allPairsPost.map((p: any) => p.urlPriority)) : 1;
    const minKeyPost = allPairsPost.length
      ? Math.min(...allPairsPost.filter((p: any) => p.urlPriority === minUrlPost).map((p: any) => p.keyPriority))
      : 1;
    for (const bu of baseUrlRows) {
      const keys = db.prepare("SELECT * FROM provider_api_keys WHERE base_url_id = ? ORDER BY priority ASC").all(bu.id) as any[];
      for (const k of keys) {
        const weight = computeDeploymentWeight({
          loadBalancing: provider.load_balancing,
          urlPriority: bu.priority ?? 1,
          keyPriority: k.priority ?? 1,
          minUrlPriority: minUrlPost,
          minKeyPriorityForMinUrl: minKeyPost,
        });
        litellmAddModel({
          modelName: name,
          litellmParams: {
            model: litellmModelString(litellmModel, provider.type),
            apiBase: bu.url ?? undefined,
            apiKey: k.key_value ? decryptSecret(k.key_value) : undefined,
            inputCostPerToken: inputCostPerMtok != null ? inputCostPerMtok / 1_000_000 : undefined,
            outputCostPerToken: outputCostPerMtok != null ? outputCostPerMtok / 1_000_000 : undefined,
            weight,
          },
        }).catch((err: any) => req.log.warn({ err }, "LiteLLM model add failed"));
      }
    }
  }

  const model = db.prepare(`
    SELECT m.*, p.name as provider_name FROM models m LEFT JOIN providers p ON m.provider_id = p.id WHERE m.id = ?
  `).get(id) as any;

  res.status(201).json(formatModel(model, model.provider_name));
});

router.put("/models/:modelId", async (req: AuthRequest, res) => {
  const { modelId } = req.params;
  const { name, litellmModel, providerId, contextWindow, inputCostPerMtok, outputCostPerMtok, enabled } = req.body;

  const existing = db.prepare("SELECT * FROM models WHERE id = ?").get(modelId) as any;
  if (!existing) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const isEnabled = enabled !== false ? 1 : 0;

  const newName         = name          ?? existing.name;
  const newLitellmModel = litellmModel  ?? existing.litellm_model;
  const newProviderId   = providerId    ?? existing.provider_id;
  const newContextWindow = contextWindow ?? existing.context_window;
  const newInputCost    = inputCostPerMtok  ?? existing.input_cost_per_mtok;
  const newOutputCost   = outputCostPerMtok ?? existing.output_cost_per_mtok;

  db.prepare(`
    UPDATE models SET name = ?, litellm_model = ?, provider_id = ?, context_window = ?,
    input_cost_per_mtok = ?, output_cost_per_mtok = ?, enabled = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newName, newLitellmModel, newProviderId, newContextWindow,
    newInputCost, newOutputCost, isEnabled, modelId);

  const model = db.prepare(`
    SELECT m.*, p.name as provider_name FROM models m LEFT JOIN providers p ON m.provider_id = p.id WHERE m.id = ?
  `).get(modelId) as any;

  // Sync to LiteLLM: delete old entry, then re-add all deployments if enabled
  if (isLiteLLMAvailable()) {
    const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(newProviderId) as any;

    try {
      if (!isEnabled || !provider) {
        // Disabled or orphaned: just delete from LiteLLM
        await litellmSyncModelUpdate(existing.name, null);
      } else {
        // Build the new deployment list
        const baseUrlRows = db.prepare(
          "SELECT * FROM provider_base_urls WHERE provider_id = ? ORDER BY priority ASC"
        ).all(newProviderId) as any[];

        // For each (base_url, key) pair, we delete-then-re-add.
        // We only need to do the delete once (using the old name to find the entry).
        // Then add all new deployments.
        const info = await litellmListModels() as any;
        const entries = (info.data ?? []).filter((m: any) => m.model_name === existing.name);
        for (const entry of entries) {
          await litellmDeleteModel(entry.model_info.id).catch(() => {});
        }

        if (isEnabled) {
          // Compute primary-tier floor for weight assignment
          const allPairsPut = baseUrlRows.flatMap((bu: any) => {
            const keys = db.prepare(
              "SELECT * FROM provider_api_keys WHERE base_url_id = ? ORDER BY priority ASC"
            ).all(bu.id) as any[];
            return keys.map((k: any) => ({ urlPriority: bu.priority ?? 1, keyPriority: k.priority ?? 1 }));
          });
          const minUrlPut = allPairsPut.length ? Math.min(...allPairsPut.map((p: any) => p.urlPriority)) : 1;
          const minKeyPut = allPairsPut.length
            ? Math.min(...allPairsPut.filter((p: any) => p.urlPriority === minUrlPut).map((p: any) => p.keyPriority))
            : 1;
          for (const bu of baseUrlRows) {
            const keys = db.prepare(
              "SELECT * FROM provider_api_keys WHERE base_url_id = ? ORDER BY priority ASC"
            ).all(bu.id) as any[];
            for (const k of keys) {
              const weight = computeDeploymentWeight({
                loadBalancing: provider.load_balancing,
                urlPriority: bu.priority ?? 1,
                keyPriority: k.priority ?? 1,
                minUrlPriority: minUrlPut,
                minKeyPriorityForMinUrl: minKeyPut,
              });
              await litellmAddModel({
                modelName: newName,
                litellmParams: {
                  model: litellmModelString(newLitellmModel, provider.type),
                  apiBase: bu.url ?? undefined,
                  apiKey: k.key_value ? decryptSecret(k.key_value) : undefined,
                  inputCostPerToken: newInputCost != null ? newInputCost / 1_000_000 : undefined,
                  outputCostPerToken: newOutputCost != null ? newOutputCost / 1_000_000 : undefined,
                  weight,
                },
              }).catch((err: any) => req.log.warn({ err }, "LiteLLM deployment add failed"));
            }
          }
        }
      }
    } catch (err: any) {
      req.log.warn({ err }, "LiteLLM model sync failed — DB updated but LiteLLM may be out of sync; will repair on next restart");
    }
  }

  res.json(formatModel(model, model.provider_name));
});

router.delete("/models/:modelId", (req, res) => {
  const { modelId } = req.params;
  const existing = db.prepare("SELECT id FROM models WHERE id = ?").get(modelId);
  if (!existing) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  db.prepare("DELETE FROM models WHERE id = ?").run(modelId);
  res.json({ message: "Model deleted" });
});

export default router;
