/**
 * Prompt-caching helpers.
 *
 * Supports two concurrent mechanisms:
 *  1. Automatic depth-based caching via the optional `cacheAtDepth` request
 *     parameter — Qillin inserts a `cache_control` block N messages before the
 *     final message.
 *  2. Manual caching — users place their own `cache_control` blocks anywhere
 *     in `messages` (or `system`). Those are passed through untouched and take
 *     precedence: automatic insertion never overwrites or duplicates an
 *     explicit block on the same message.
 */

export interface CacheControlBlock {
  type: "ephemeral";
  ttl?: string;
}

export const EPHEMERAL_CACHE_CONTROL: CacheControlBlock = { type: "ephemeral" };

type MessageContent =
  | string
  | Array<Record<string, unknown>>
  | null
  | undefined;

interface ChatMessage {
  role?: string;
  content?: MessageContent;
  cache_control?: unknown;
  [key: string]: unknown;
}

/**
 * Validate the raw `cacheAtDepth` value from a request body.
 * Returns the depth when it is a positive integer, otherwise null.
 */
export function parseCacheAtDepth(raw: unknown): number | null {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** True when a message (or any of its content blocks) already carries a manual cache block. */
function hasManualCacheControl(message: ChatMessage): boolean {
  if (message.cache_control != null) return true;
  if (Array.isArray(message.content)) {
    return message.content.some(
      (block) => block != null && typeof block === "object" && (block as any).cache_control != null,
    );
  }
  return false;
}

/**
 * Attach `cache_control` to a single message.
 * - String content is upgraded to content-block form so it can carry the marker.
 * - Array content gets the marker on its last block (Anthropic caches the
 *   prefix up to and including the marked block).
 * Returns a NEW message object; the input is not mutated.
 */
function withCacheControl(message: ChatMessage): ChatMessage {
  const { content } = message;

  if (typeof content === "string") {
    return {
      ...message,
      content: [{ type: "text", text: content, cache_control: { ...EPHEMERAL_CACHE_CONTROL } }],
    };
  }

  if (Array.isArray(content) && content.length > 0) {
    const blocks = content.map((b) => ({ ...(b as Record<string, unknown>) }));
    const last = blocks[blocks.length - 1];
    // Tool-result / multimodal blocks accept cache_control the same way.
    last.cache_control = { ...EPHEMERAL_CACHE_CONTROL };
    return { ...message, content: blocks };
  }

  // Empty/null content (e.g. pure tool_calls): fall back to an empty text block.
  return {
    ...message,
    content: [{ type: "text", text: "", cache_control: { ...EPHEMERAL_CACHE_CONTROL } }],
  };
}

/**
 * Insert an automatic cache block at the requested depth.
 *
 * Depth is counted as N messages before the final message:
 *   depth 1 → the message immediately preceding the final one,
 *   depth 3 → three messages before the final one, etc.
 * Depths beyond the conversation length clamp to the first message (caching
 * the oldest available context, which is the most useful cache anchor).
 *
 * If the target message already carries a manual `cache_control` block, the
 * message array is returned unchanged (manual wins; the two mechanisms never
 * conflict).
 */
export function applyCacheAtDepth(messages: unknown, depth: number): unknown {
  if (!Array.isArray(messages) || messages.length === 0) return messages;

  const targetIndex = Math.max(0, messages.length - 1 - depth);
  const target = messages[targetIndex] as ChatMessage;

  if (target == null || typeof target !== "object") return messages;
  if (hasManualCacheControl(target)) return messages;

  const next = messages.slice();
  next[targetIndex] = withCacheControl(target);
  return next;
}

/**
 * Apply the full cacheAtDepth transform to a parsed /chat/completions body.
 * Strips the non-standard `cacheAtDepth` parameter so it never reaches the
 * upstream provider. Returns true when the body was processed (regardless of
 * whether insertion happened), false when there was nothing to do.
 */
export function transformChatCompletionsBody(body: any): boolean {
  if (body == null || typeof body !== "object") return false;
  if (!("cacheAtDepth" in body)) return false;

  const raw = body.cacheAtDepth;
  delete body.cacheAtDepth;

  const depth = parseCacheAtDepth(raw);
  if (depth == null) {
    // Invalid value — parameter removed, request proceeds uncached rather than failing.
    return true;
  }

  body.messages = applyCacheAtDepth(body.messages, depth);
  return true;
}
