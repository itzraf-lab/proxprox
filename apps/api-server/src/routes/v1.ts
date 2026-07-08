/**
 * /v1/* routes handled natively by Qillin (before the LiteLLM proxy).
 *
 * Authentication is handled by the app-level requireApiOrJwtAuth middleware
 * applied in app.ts before this router. req.user is always populated here.
 *
 * These handlers intercept specific OpenAI-compatible endpoints so Qillin can
 * return DB-sourced data. Any path NOT matched here falls through to the
 * LiteLLM streaming proxy mounted in app.ts.
 */
import { Router } from "express";
import { db } from "../db/index.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

/**
 * GET /v1/models
 *
 * OpenAI-compatible model listing. Requires a valid Qillin Bearer token or
 * Qillin API key (enforced by app-level middleware in app.ts).
 *
 * Returns only enabled models; respects the per-user `allowed_models` list
 * when set.
 *
 * Response shape matches the OpenAI /v1/models spec:
 *   { object: "list", data: [ { id, object, created, owned_by, ... } ] }
 */
router.get("/models", (req: AuthRequest, res) => {
  const user = req.user!;

  const rows = db
    .prepare(
      `SELECT m.name, m.litellm_model, m.context_window,
              m.input_cost_per_mtok, m.output_cost_per_mtok,
              m.created_at, p.name AS provider_name
       FROM models m
       LEFT JOIN providers p ON m.provider_id = p.id
       WHERE m.enabled = 1
       ORDER BY m.name ASC`,
    )
    .all() as any[];

  // Optionally filter by per-user allowed_models.
  // Stored as JSON array (e.g. ["gpt-4","claude-3"]); fall back to legacy
  // comma-separated string for backwards compatibility.
  let models = rows;
  if (user.allowed_models) {
    let allowedList: string[] = [];
    try {
      const parsed = JSON.parse(user.allowed_models);
      allowedList = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Legacy: plain comma-separated string
      allowedList = user.allowed_models.split(",").map((s: string) => s.trim());
    }
    const allowed = new Set(allowedList);
    models = rows.filter((m) => allowed.has(m.name) || allowed.has(m.litellm_model));
  }

  const data = models.map((m) => ({
    id: m.name,
    object: "model",
    created: m.created_at
      ? Math.floor(new Date(m.created_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000),
    owned_by: m.provider_name ?? "qillin",
    // Extra Qillin fields (ignored by standard OpenAI clients, useful for custom ones)
    name: m.name,
    context_window: m.context_window,
    input_cost_per_mtok: m.input_cost_per_mtok,
    output_cost_per_mtok: m.output_cost_per_mtok,
  }));

  res.json({ object: "list", data });
});

export default router;
