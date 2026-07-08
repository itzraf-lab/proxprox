import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

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

// GET /api/models
router.get("/", (_req, res) => {
  const models = db
    .prepare(`
      SELECT m.*, p.name as provider_name
      FROM models m
      LEFT JOIN providers p ON m.provider_id = p.id
      WHERE m.enabled = 1
      ORDER BY m.name ASC
    `)
    .all() as any[];

  res.json(models.map((m: any) => formatModel(m, m.provider_name)));
});

// GET /api/models/:modelId
router.get("/:modelId", (req, res) => {
  const model = db
    .prepare(`
      SELECT m.*, p.name as provider_name
      FROM models m
      LEFT JOIN providers p ON m.provider_id = p.id
      WHERE m.id = ?
    `)
    .get(req.params.modelId) as any;

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  res.json(formatModel(model, model.provider_name));
});

export default router;
