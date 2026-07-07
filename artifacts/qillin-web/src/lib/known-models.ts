export interface KnownModel {
  litellmModel: string
  displayName: string
  contextWindow: number
  inputCostPerMtok: number
  outputCostPerMtok: number
  category: string
}

export const KNOWN_MODELS: KnownModel[] = [
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { litellmModel: "gpt-4o",                       displayName: "GPT-4o",                     contextWindow: 128_000, inputCostPerMtok: 2.50,  outputCostPerMtok: 10.00, category: "OpenAI" },
  { litellmModel: "gpt-4o-mini",                  displayName: "GPT-4o Mini",                contextWindow: 128_000, inputCostPerMtok: 0.15,  outputCostPerMtok: 0.60,  category: "OpenAI" },
  { litellmModel: "gpt-4-turbo",                  displayName: "GPT-4 Turbo",                contextWindow: 128_000, inputCostPerMtok: 10.00, outputCostPerMtok: 30.00, category: "OpenAI" },
  { litellmModel: "gpt-4",                        displayName: "GPT-4",                      contextWindow: 8_192,   inputCostPerMtok: 30.00, outputCostPerMtok: 60.00, category: "OpenAI" },
  { litellmModel: "gpt-3.5-turbo",                displayName: "GPT-3.5 Turbo",              contextWindow: 16_385,  inputCostPerMtok: 0.50,  outputCostPerMtok: 1.50,  category: "OpenAI" },
  { litellmModel: "o1",                           displayName: "o1",                         contextWindow: 200_000, inputCostPerMtok: 15.00, outputCostPerMtok: 60.00, category: "OpenAI" },
  { litellmModel: "o1-mini",                      displayName: "o1 Mini",                    contextWindow: 128_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 12.00, category: "OpenAI" },
  { litellmModel: "o3",                           displayName: "o3",                         contextWindow: 200_000, inputCostPerMtok: 10.00, outputCostPerMtok: 40.00, category: "OpenAI" },
  { litellmModel: "o3-mini",                      displayName: "o3 Mini",                    contextWindow: 200_000, inputCostPerMtok: 1.10,  outputCostPerMtok: 4.40,  category: "OpenAI" },
  { litellmModel: "o4-mini",                      displayName: "o4 Mini",                    contextWindow: 200_000, inputCostPerMtok: 1.10,  outputCostPerMtok: 4.40,  category: "OpenAI" },
  { litellmModel: "text-embedding-3-small",       displayName: "Embedding 3 Small",          contextWindow: 8_191,   inputCostPerMtok: 0.02,  outputCostPerMtok: 0,     category: "OpenAI" },
  { litellmModel: "text-embedding-3-large",       displayName: "Embedding 3 Large",          contextWindow: 8_191,   inputCostPerMtok: 0.13,  outputCostPerMtok: 0,     category: "OpenAI" },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  { litellmModel: "claude-opus-4-5",                   displayName: "Claude Opus 4.5",            contextWindow: 200_000, inputCostPerMtok: 15.00, outputCostPerMtok: 75.00, category: "Anthropic" },
  { litellmModel: "claude-sonnet-4-5",                 displayName: "Claude Sonnet 4.5",          contextWindow: 200_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00, category: "Anthropic" },
  { litellmModel: "claude-3-5-sonnet-20241022",   displayName: "Claude 3.5 Sonnet",          contextWindow: 200_000, inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00, category: "Anthropic" },
  { litellmModel: "claude-3-5-haiku-20241022",    displayName: "Claude 3.5 Haiku",           contextWindow: 200_000, inputCostPerMtok: 0.80,  outputCostPerMtok: 4.00,  category: "Anthropic" },
  { litellmModel: "claude-3-opus-20240229",       displayName: "Claude 3 Opus",              contextWindow: 200_000, inputCostPerMtok: 15.00, outputCostPerMtok: 75.00, category: "Anthropic" },
  { litellmModel: "claude-3-haiku-20240307",      displayName: "Claude 3 Haiku",             contextWindow: 200_000, inputCostPerMtok: 0.25,  outputCostPerMtok: 1.25,  category: "Anthropic" },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  { litellmModel: "gemini/gemini-2.5-pro",        displayName: "Gemini 2.5 Pro",             contextWindow: 1_048_576, inputCostPerMtok: 1.25, outputCostPerMtok: 10.00, category: "Google" },
  { litellmModel: "gemini/gemini-2.5-flash",      displayName: "Gemini 2.5 Flash",           contextWindow: 1_048_576, inputCostPerMtok: 0.15, outputCostPerMtok: 0.60,  category: "Google" },
  { litellmModel: "gemini/gemini-2.0-flash",      displayName: "Gemini 2.0 Flash",           contextWindow: 1_048_576, inputCostPerMtok: 0.10, outputCostPerMtok: 0.40,  category: "Google" },
  { litellmModel: "gemini/gemini-1.5-pro",        displayName: "Gemini 1.5 Pro",             contextWindow: 2_097_152, inputCostPerMtok: 1.25, outputCostPerMtok: 5.00,  category: "Google" },
  { litellmModel: "gemini/gemini-1.5-flash",      displayName: "Gemini 1.5 Flash",           contextWindow: 1_048_576, inputCostPerMtok: 0.075,outputCostPerMtok: 0.30,  category: "Google" },

  // ── Mistral ───────────────────────────────────────────────────────────────
  { litellmModel: "mistral/mistral-large-latest", displayName: "Mistral Large",              contextWindow: 131_072,  inputCostPerMtok: 2.00,  outputCostPerMtok: 6.00,  category: "Mistral" },
  { litellmModel: "mistral/mistral-small-latest", displayName: "Mistral Small",              contextWindow: 131_072,  inputCostPerMtok: 0.20,  outputCostPerMtok: 0.60,  category: "Mistral" },
  { litellmModel: "mistral/codestral-latest",     displayName: "Codestral",                  contextWindow: 262_144,  inputCostPerMtok: 0.20,  outputCostPerMtok: 0.60,  category: "Mistral" },
  { litellmModel: "mistral/mixtral-8x7b-instruct-v0.1", displayName: "Mixtral 8×7B",        contextWindow: 32_768,   inputCostPerMtok: 0.70,  outputCostPerMtok: 0.70,  category: "Mistral" },
  { litellmModel: "mistral/mixtral-8x22b-instruct-v0.1", displayName: "Mixtral 8×22B",      contextWindow: 65_536,   inputCostPerMtok: 2.00,  outputCostPerMtok: 6.00,  category: "Mistral" },

  // ── Meta Llama ────────────────────────────────────────────────────────────
  { litellmModel: "meta-llama/llama-3.3-70b-instruct", displayName: "Llama 3.3 70B",        contextWindow: 131_072,  inputCostPerMtok: 0.23,  outputCostPerMtok: 0.40,  category: "Meta" },
  { litellmModel: "meta-llama/llama-3.2-90b-vision-instruct", displayName: "Llama 3.2 90B Vision", contextWindow: 131_072, inputCostPerMtok: 0.90, outputCostPerMtok: 0.90, category: "Meta" },
  { litellmModel: "meta-llama/llama-3.2-11b-vision-instruct", displayName: "Llama 3.2 11B Vision", contextWindow: 131_072, inputCostPerMtok: 0.18, outputCostPerMtok: 0.18, category: "Meta" },
  { litellmModel: "meta-llama/llama-3.1-405b-instruct", displayName: "Llama 3.1 405B",     contextWindow: 131_072,  inputCostPerMtok: 3.00,  outputCostPerMtok: 3.00,  category: "Meta" },
  { litellmModel: "meta-llama/llama-3.1-70b-instruct",  displayName: "Llama 3.1 70B",      contextWindow: 131_072,  inputCostPerMtok: 0.23,  outputCostPerMtok: 0.40,  category: "Meta" },
  { litellmModel: "meta-llama/llama-3.1-8b-instruct",   displayName: "Llama 3.1 8B",       contextWindow: 131_072,  inputCostPerMtok: 0.18,  outputCostPerMtok: 0.18,  category: "Meta" },
  { litellmModel: "meta-llama/llama-4-scout",           displayName: "Llama 4 Scout",       contextWindow: 131_072,  inputCostPerMtok: 0.18,  outputCostPerMtok: 0.18,  category: "Meta" },
  { litellmModel: "meta-llama/llama-4-maverick",        displayName: "Llama 4 Maverick",    contextWindow: 131_072,  inputCostPerMtok: 0.50,  outputCostPerMtok: 0.77,  category: "Meta" },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { litellmModel: "deepseek/deepseek-chat",        displayName: "DeepSeek Chat (V3)",        contextWindow: 64_000,   inputCostPerMtok: 0.27,  outputCostPerMtok: 1.10,  category: "DeepSeek" },
  { litellmModel: "deepseek/deepseek-reasoner",    displayName: "DeepSeek R1",               contextWindow: 64_000,   inputCostPerMtok: 0.55,  outputCostPerMtok: 2.19,  category: "DeepSeek" },

  // ── Cohere ────────────────────────────────────────────────────────────────
  { litellmModel: "command-r-plus",               displayName: "Command R+",                 contextWindow: 128_000,  inputCostPerMtok: 2.50,  outputCostPerMtok: 10.00, category: "Cohere" },
  { litellmModel: "command-r",                    displayName: "Command R",                  contextWindow: 128_000,  inputCostPerMtok: 0.15,  outputCostPerMtok: 0.60,  category: "Cohere" },

  // ── Perplexity ────────────────────────────────────────────────────────────
  { litellmModel: "perplexity/sonar-pro",         displayName: "Sonar Pro",                  contextWindow: 200_000,  inputCostPerMtok: 3.00,  outputCostPerMtok: 15.00, category: "Perplexity" },
  { litellmModel: "perplexity/sonar",             displayName: "Sonar",                      contextWindow: 127_000,  inputCostPerMtok: 1.00,  outputCostPerMtok: 1.00,  category: "Perplexity" },

  // ── Qwen ──────────────────────────────────────────────────────────────────
  { litellmModel: "qwen/qwen-max",                displayName: "Qwen Max",                   contextWindow: 32_768,   inputCostPerMtok: 1.60,  outputCostPerMtok: 1.60,  category: "Qwen" },
  { litellmModel: "qwen/qwen-plus",               displayName: "Qwen Plus",                  contextWindow: 131_072,  inputCostPerMtok: 0.40,  outputCostPerMtok: 1.20,  category: "Qwen" },
  { litellmModel: "qwen/qwen-turbo",              displayName: "Qwen Turbo",                 contextWindow: 131_072,  inputCostPerMtok: 0.05,  outputCostPerMtok: 0.15,  category: "Qwen" },

  // ── Local / Custom ────────────────────────────────────────────────────────
  { litellmModel: "ollama/llama3.2",              displayName: "Ollama: Llama 3.2",          contextWindow: 131_072,  inputCostPerMtok: 0, outputCostPerMtok: 0, category: "Local" },
  { litellmModel: "ollama/mistral",               displayName: "Ollama: Mistral 7B",         contextWindow: 32_768,   inputCostPerMtok: 0, outputCostPerMtok: 0, category: "Local" },
  { litellmModel: "ollama/phi4",                  displayName: "Ollama: Phi-4",              contextWindow: 16_384,   inputCostPerMtok: 0, outputCostPerMtok: 0, category: "Local" },
  { litellmModel: "ollama/gemma3",                displayName: "Ollama: Gemma 3",            contextWindow: 131_072,  inputCostPerMtok: 0, outputCostPerMtok: 0, category: "Local" },
  { litellmModel: "openai/custom",                displayName: "Custom OpenAI-compatible",   contextWindow: 4_096,    inputCostPerMtok: 0, outputCostPerMtok: 0, category: "Local" },
]

export const CATEGORIES = [...new Set(KNOWN_MODELS.map(m => m.category))]

export function lookupKnownModel(litellmModel: string): KnownModel | null {
  return KNOWN_MODELS.find(m => m.litellmModel === litellmModel) ?? null
}

export function fmtCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}
