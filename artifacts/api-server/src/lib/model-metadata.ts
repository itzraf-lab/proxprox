/**
 * Static metadata for well-known models.
 * Pricing is in USD per million tokens (input / output).
 * contextWindow is in tokens.
 *
 * Lookup priority: exact → prefix (model ID starts with key) → suffix (key appears at end)
 */

export interface ModelMeta {
  contextWindow: number;
  inputCostPerMtok: number;
  outputCostPerMtok: number;
}

const METADATA: Record<string, ModelMeta> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  "gpt-4o":                        { contextWindow: 128_000, inputCostPerMtok: 2.50,  outputCostPerMtok: 10.00 },
  "gpt-4o-mini":                   { contextWindow: 128_000, inputCostPerMtok: 0.15,  outputCostPerMtok: 0.60  },
  "gpt-4o-audio-preview":          { contextWindow: 128_000, inputCostPerMtok: 2.50,  outputCostPerMtok: 10.00 },
  "gpt-4-turbo":                   { contextWindow: 128_000, inputCostPerMtok: 10.00, outputCostPerMtok: 30.00 },
  "gpt-4-turbo-preview":           { contextWindow: 128_000, inputCostPerMtok: 10.00, outputCostPerMtok: 30.00 },
  "gpt-4-32k":                     { contextWindow: 32_768,  inputCostPerMtok: 60.00, outputCostPerMtok: 120.00 },
  "gpt-4":                         { contextWindow: 8_192,   inputCostPerMtok: 30.00, outputCostPerMtok: 60.00  },
  "gpt-3.5-turbo":                 { contextWindow: 16_385,  inputCostPerMtok: 0.50,  outputCostPerMtok: 1.50  },
  "gpt-3.5-turbo-16k":             { contextWindow: 16_385,  inputCostPerMtok: 3.00,  outputCostPerMtok: 4.00  },
  "o1":                            { contextWindow: 200_000, inputCostPerMtok: 15.00, outputCostPerMtok: 60.00 },
  "o1-mini":                       { contextWindow: 128_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 12.00 },
  "o1-preview":                    { contextWindow: 128_000, inputCostPerMtok: 15.00, outputCostPerMtok: 60.00 },
  "o3":                            { contextWindow: 200_000, inputCostPerMtok: 10.00, outputCostPerMtok: 40.00 },
  "o3-mini":                       { contextWindow: 200_000, inputCostPerMtok: 1.10,  outputCostPerMtok: 4.40  },
  "o4-mini":                       { contextWindow: 200_000, inputCostPerMtok: 1.10,  outputCostPerMtok: 4.40  },
  "text-embedding-3-small":        { contextWindow: 8_191,   inputCostPerMtok: 0.02,  outputCostPerMtok: 0     },
  "text-embedding-3-large":        { contextWindow: 8_191,   inputCostPerMtok: 0.13,  outputCostPerMtok: 0     },
  "text-embedding-ada-002":        { contextWindow: 8_191,   inputCostPerMtok: 0.10,  outputCostPerMtok: 0     },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  "claude-opus-4":                     { contextWindow: 200_000, inputCostPerMtok: 15.00, outputCostPerMtok: 75.00  },
  "claude-sonnet-4":                   { contextWindow: 200_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00  },
  "claude-3-5-sonnet":                 { contextWindow: 200_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00  },
  "claude-3-5-haiku":                  { contextWindow: 200_000, inputCostPerMtok: 0.80,  outputCostPerMtok: 4.00   },
  "claude-3-opus":                     { contextWindow: 200_000, inputCostPerMtok: 15.00, outputCostPerMtok: 75.00  },
  "claude-3-sonnet":                   { contextWindow: 200_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00  },
  "claude-3-haiku":                    { contextWindow: 200_000, inputCostPerMtok: 0.25,  outputCostPerMtok: 1.25   },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  "gemini-2.5-pro":                { contextWindow: 1_048_576, inputCostPerMtok: 1.25,  outputCostPerMtok: 10.00 },
  "gemini-2.5-flash":              { contextWindow: 1_048_576, inputCostPerMtok: 0.15,  outputCostPerMtok: 0.60  },
  "gemini-2.0-flash":              { contextWindow: 1_048_576, inputCostPerMtok: 0.10,  outputCostPerMtok: 0.40  },
  "gemini-1.5-pro":                { contextWindow: 2_097_152, inputCostPerMtok: 1.25,  outputCostPerMtok: 5.00  },
  "gemini-1.5-flash":              { contextWindow: 1_048_576, inputCostPerMtok: 0.075, outputCostPerMtok: 0.30  },
  "gemini-1.0-pro":                { contextWindow: 32_760,   inputCostPerMtok: 0.50,  outputCostPerMtok: 1.50  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  "mistral-large":                 { contextWindow: 131_072,  inputCostPerMtok: 2.00,  outputCostPerMtok: 6.00  },
  "mistral-medium":                { contextWindow: 131_072,  inputCostPerMtok: 2.70,  outputCostPerMtok: 8.10  },
  "mistral-small":                 { contextWindow: 131_072,  inputCostPerMtok: 0.20,  outputCostPerMtok: 0.60  },
  "mistral-7b-instruct":           { contextWindow: 32_768,   inputCostPerMtok: 0.25,  outputCostPerMtok: 0.25  },
  "mixtral-8x7b-instruct":         { contextWindow: 32_768,   inputCostPerMtok: 0.70,  outputCostPerMtok: 0.70  },
  "mixtral-8x22b-instruct":        { contextWindow: 65_536,   inputCostPerMtok: 2.00,  outputCostPerMtok: 6.00  },
  "codestral":                     { contextWindow: 262_144,  inputCostPerMtok: 0.20,  outputCostPerMtok: 0.60  },

  // ── Meta Llama ────────────────────────────────────────────────────────────
  "llama-3.3-70b":                 { contextWindow: 131_072,  inputCostPerMtok: 0.23,  outputCostPerMtok: 0.40  },
  "llama-3.2-90b":                 { contextWindow: 131_072,  inputCostPerMtok: 0.90,  outputCostPerMtok: 0.90  },
  "llama-3.2-11b":                 { contextWindow: 131_072,  inputCostPerMtok: 0.18,  outputCostPerMtok: 0.18  },
  "llama-3.2-3b":                  { contextWindow: 131_072,  inputCostPerMtok: 0.06,  outputCostPerMtok: 0.06  },
  "llama-3.2-1b":                  { contextWindow: 131_072,  inputCostPerMtok: 0.04,  outputCostPerMtok: 0.04  },
  "llama-3.1-405b":                { contextWindow: 131_072,  inputCostPerMtok: 3.00,  outputCostPerMtok: 3.00  },
  "llama-3.1-70b":                 { contextWindow: 131_072,  inputCostPerMtok: 0.23,  outputCostPerMtok: 0.40  },
  "llama-3.1-8b":                  { contextWindow: 131_072,  inputCostPerMtok: 0.18,  outputCostPerMtok: 0.18  },
  "llama-3-70b":                   { contextWindow: 8_192,    inputCostPerMtok: 0.59,  outputCostPerMtok: 0.79  },
  "llama-3-8b":                    { contextWindow: 8_192,    inputCostPerMtok: 0.20,  outputCostPerMtok: 0.20  },
  "llama-2-70b":                   { contextWindow: 4_096,    inputCostPerMtok: 0.70,  outputCostPerMtok: 0.90  },
  "llama-2-13b":                   { contextWindow: 4_096,    inputCostPerMtok: 0.20,  outputCostPerMtok: 0.20  },
  "llama-2-7b":                    { contextWindow: 4_096,    inputCostPerMtok: 0.10,  outputCostPerMtok: 0.10  },
  "llama4-scout":                  { contextWindow: 131_072,  inputCostPerMtok: 0.18,  outputCostPerMtok: 0.18  },
  "llama4-maverick":               { contextWindow: 131_072,  inputCostPerMtok: 0.50,  outputCostPerMtok: 0.77  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  "deepseek-chat":                 { contextWindow: 64_000,   inputCostPerMtok: 0.27,  outputCostPerMtok: 1.10  },
  "deepseek-coder":                { contextWindow: 128_000,  inputCostPerMtok: 0.14,  outputCostPerMtok: 0.28  },
  "deepseek-r1":                   { contextWindow: 64_000,   inputCostPerMtok: 0.55,  outputCostPerMtok: 2.19  },

  // ── Qwen / Alibaba ────────────────────────────────────────────────────────
  "qwen-max":                      { contextWindow: 32_768,   inputCostPerMtok: 1.60,  outputCostPerMtok: 1.60  },
  "qwen-plus":                     { contextWindow: 131_072,  inputCostPerMtok: 0.40,  outputCostPerMtok: 1.20  },
  "qwen-turbo":                    { contextWindow: 131_072,  inputCostPerMtok: 0.05,  outputCostPerMtok: 0.15  },
  "qwen2.5-72b":                   { contextWindow: 131_072,  inputCostPerMtok: 0.23,  outputCostPerMtok: 0.40  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  "command-r-plus":                { contextWindow: 128_000,  inputCostPerMtok: 2.50,  outputCostPerMtok: 10.00 },
  "command-r":                     { contextWindow: 128_000,  inputCostPerMtok: 0.15,  outputCostPerMtok: 0.60  },
  "command":                       { contextWindow: 4_096,    inputCostPerMtok: 1.00,  outputCostPerMtok: 2.00  },
  "embed-english-v3.0":            { contextWindow: 512,      inputCostPerMtok: 0.10,  outputCostPerMtok: 0     },

  // ── Perplexity ────────────────────────────────────────────────────────────
  "sonar-pro":                     { contextWindow: 200_000,  inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00 },
  "sonar":                         { contextWindow: 127_000,  inputCostPerMtok: 1.00,  outputCostPerMtok: 1.00  },
  "sonar-reasoning-pro":           { contextWindow: 127_000,  inputCostPerMtok: 2.00,  outputCostPerMtok: 8.00  },

  // ── Local / open-weight (context only, no cost) ───────────────────────────
  "phi-3-mini":                    { contextWindow: 128_000,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "phi-3-medium":                  { contextWindow: 128_000,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "phi-3.5-mini":                  { contextWindow: 128_000,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "phi-4":                         { contextWindow: 16_384,   inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "gemma-2-9b":                    { contextWindow: 8_192,    inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "gemma-2-27b":                   { contextWindow: 8_192,    inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "gemma-3-27b":                   { contextWindow: 131_072,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "mistral-7b":                    { contextWindow: 32_768,   inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "codellama-7b":                  { contextWindow: 100_000,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "codellama-13b":                 { contextWindow: 100_000,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
  "codellama-34b":                 { contextWindow: 100_000,  inputCostPerMtok: 0, outputCostPerMtok: 0 },
};

/**
 * Look up metadata for a model ID.
 * Tries: exact match → any key that is a prefix of modelId → any key contained in modelId.
 */
export function lookupModelMeta(modelId: string): ModelMeta | null {
  const id = modelId.toLowerCase();

  // 1. Exact match
  if (METADATA[id]) return METADATA[id];

  // 2. Known key is a prefix of the model ID (e.g., "gpt-4o" matches "gpt-4o-2024-11-20")
  //    Use longest prefix to avoid "gpt-4" matching "gpt-4o"
  let bestPrefixKey = "";
  for (const key of Object.keys(METADATA)) {
    if (id.startsWith(key) && key.length > bestPrefixKey.length) {
      bestPrefixKey = key;
    }
  }
  if (bestPrefixKey) return METADATA[bestPrefixKey];

  // 3. Known key is contained anywhere in the model ID
  //    (e.g., "accounts/fireworks/models/llama-3.1-70b-instruct")
  let bestContainKey = "";
  for (const key of Object.keys(METADATA)) {
    if (id.includes(key) && key.length > bestContainKey.length) {
      bestContainKey = key;
    }
  }
  if (bestContainKey) return METADATA[bestContainKey];

  return null;
}
