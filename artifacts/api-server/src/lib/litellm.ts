/**
 * LiteLLM admin API client.
 * Calls the internal LiteLLM proxy server at LITELLM_URL.
 */

const LITELLM_URL = process.env.LITELLM_URL ?? "http://localhost:8000";
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY ?? "";

function litellmHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
  };
}

async function litellmFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${LITELLM_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...litellmHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let errorText = "";
    try {
      const errBody = await res.json() as any;
      errorText = errBody?.error?.message ?? errBody?.detail ?? JSON.stringify(errBody);
    } catch {
      errorText = await res.text();
    }
    throw new Error(`LiteLLM API error ${res.status}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// ── User management ──────────────────────────────────────────────────────────

export async function litellmCreateUser(params: {
  userId: string;
  email: string;
  maxBudget?: number;
}) {
  return litellmFetch("/user/new", {
    method: "POST",
    body: JSON.stringify({
      user_id: params.userId,
      user_email: params.email,
      max_budget: params.maxBudget ?? null,
    }),
  });
}

export async function litellmUpdateUser(params: {
  userId: string;
  maxBudget?: number;
  allowedModels?: string[] | null;
}) {
  return litellmFetch("/user/update", {
    method: "POST",
    body: JSON.stringify({
      user_id: params.userId,
      max_budget: params.maxBudget,
      models: params.allowedModels ?? null,
    }),
  });
}

export async function litellmGetUserInfo(userId: string) {
  return litellmFetch(`/user/info?user_id=${encodeURIComponent(userId)}`);
}

export async function litellmGetAllUsers() {
  return litellmFetch<any>("/user/list");
}

// ── Key management ───────────────────────────────────────────────────────────

export async function litellmGenerateKey(params: {
  userId: string;
  name: string;
  maxBudget?: number | null;
  models?: string[] | null;
}) {
  return litellmFetch<any>("/key/generate", {
    method: "POST",
    body: JSON.stringify({
      user_id: params.userId,
      key_alias: params.name,
      max_budget: params.maxBudget ?? null,
      models: params.models ?? null,
    }),
  });
}

export async function litellmDeleteKey(keyHash: string) {
  return litellmFetch("/key/delete", {
    method: "POST",
    body: JSON.stringify({ keys: [keyHash] }),
  });
}

export async function litellmGetKeyInfo(key: string) {
  return litellmFetch<any>(`/key/info?key=${encodeURIComponent(key)}`);
}

// ── Model management ─────────────────────────────────────────────────────────

export async function litellmAddModel(params: {
  modelName: string;
  litellmParams: {
    model: string;
    apiBase?: string;
    apiKey?: string;
    inputCostPerToken?: number;
    outputCostPerToken?: number;
  };
}) {
  return litellmFetch("/model/new", {
    method: "POST",
    body: JSON.stringify({
      model_name: params.modelName,
      litellm_params: {
        model: params.litellmParams.model,
        ...(params.litellmParams.apiBase ? { api_base: params.litellmParams.apiBase } : {}),
        ...(params.litellmParams.apiKey ? { api_key: params.litellmParams.apiKey } : {}),
        ...(params.litellmParams.inputCostPerToken != null
          ? { input_cost_per_token: params.litellmParams.inputCostPerToken }
          : {}),
        ...(params.litellmParams.outputCostPerToken != null
          ? { output_cost_per_token: params.litellmParams.outputCostPerToken }
          : {}),
      },
    }),
  });
}

export async function litellmDeleteModel(modelId: string) {
  return litellmFetch("/model/delete", {
    method: "POST",
    body: JSON.stringify({ id: modelId }),
  });
}

export async function litellmListModels() {
  return litellmFetch<any>("/model/info");
}

// ── Spend & activity ─────────────────────────────────────────────────────────

export async function litellmGetSpendLogs(params?: {
  startDate?: string;
  endDate?: string;
  userId?: string;
}) {
  const qp = new URLSearchParams();
  if (params?.startDate) qp.set("start_date", params.startDate);
  if (params?.endDate) qp.set("end_date", params.endDate);
  if (params?.userId) qp.set("user_id", params.userId);
  const qs = qp.toString();
  return litellmFetch<any>(`/spend/logs${qs ? `?${qs}` : ""}`);
}

export async function litellmGetSpendByUser() {
  return litellmFetch<any>("/spend/users");
}

export async function litellmGetSpendByModel() {
  return litellmFetch<any>("/spend/models");
}

// ── Provider model fetching ───────────────────────────────────────────────────

export interface FetchedModelInfo {
  id: string;
  name: string;
  contextWindow: number | null;
  inputCostPerMtok: number | null;
  outputCostPerMtok: number | null;
  metaSource: "known" | "provider" | "unknown";
}

export async function fetchModelsFromProvider(params: {
  type: string;
  baseUrl?: string | null;
  apiKey: string;
}): Promise<FetchedModelInfo[]> {
  const { lookupModelMeta } = await import("./model-metadata.js");
  const baseUrl = params.baseUrl ?? getDefaultBaseUrl(params.type);

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Provider API returned ${res.status}`);
    }

    const data = await res.json() as any;
    const modelList = data?.data ?? data?.models ?? [];

    return modelList.map((m: any) => {
      const modelId: string = m.id ?? m.name ?? "";
      const providerContext: number | null = m.context_length ?? m.context_window ?? null;

      const meta = lookupModelMeta(modelId);

      if (meta) {
        return {
          id: modelId,
          name: modelId,
          contextWindow: meta.contextWindow,
          inputCostPerMtok: meta.inputCostPerMtok,
          outputCostPerMtok: meta.outputCostPerMtok,
          metaSource: "known" as const,
        };
      }

      if (providerContext != null) {
        return {
          id: modelId,
          name: modelId,
          contextWindow: providerContext,
          inputCostPerMtok: null,
          outputCostPerMtok: null,
          metaSource: "provider" as const,
        };
      }

      return {
        id: modelId,
        name: modelId,
        contextWindow: null,
        inputCostPerMtok: null,
        outputCostPerMtok: null,
        metaSource: "unknown" as const,
      };
    });
  } catch (err: any) {
    throw new Error(`Failed to fetch models: ${err.message}`);
  }
}

function getDefaultBaseUrl(type: string): string {
  switch (type) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

export function isLiteLLMAvailable(): boolean {
  return Boolean(LITELLM_MASTER_KEY);
}
