/**
 * /v1/* routes handled natively by Qillin (before the LiteLLM proxy).
 *
 * These handlers intercept specific OpenAI-compatible endpoints so Qillin can
 * apply its own auth and return DB-sourced data. Any path NOT matched here
 * falls through to the LiteLLM streaming proxy mounted in app.ts.
 */
import { Router } from "express";
import { db } from "../db/index.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

/**
 * GET /v1/models
 *
 * OpenAI-compatible model listing. Requires a valid Qillin Bearer token.
 * Returns only enabled models; respects the per-user `allowed_models` list
 * when set.
 *
 * Response shape matches the OpenAI /v1/models spec:
 *   { object: "list", data: [ { id, object, created, owned_by, context_window, ... } ] }
 */
router.get("/models", requireAuth, (req: AuthRequest, res) => {
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

  // Optionally filter by per-user allowed_models (comma-separated model names)
  let models = rows;
  if (user.allowed_models) {
    const allowed = new Set(
      user.allowed_models.split(",").map((s: string) => s.trim()),
    );
    models = rows.filter((m) => allowed.has(m.name) || allowed.has(m.litellm_model));
  }

  const data = models.map((m) => ({
    id: m.litellm_model,
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
