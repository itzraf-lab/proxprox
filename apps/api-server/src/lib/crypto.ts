/**
 * At-rest encryption for sensitive values stored in SQLite (provider API keys).
 *
 * Uses AES-256-GCM with a key derived from JWT_SECRET via scrypt with a
 * fixed, purpose-specific salt. This gives key separation from JWT signing
 * without requiring a second secret to be provisioned — JWT_SECRET is
 * already a high-entropy server secret managed by Replit's secrets store.
 *
 * Fails fast at import time if JWT_SECRET is missing, matching lib/auth.ts,
 * so a misconfigured deployment never silently stores plaintext.
 */
import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required (also used to derive the provider-key encryption key). Refusing to start without it.",
  );
}

const ENC_PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

// Derive a dedicated 32-byte key from JWT_SECRET, scoped to this purpose so
// it is cryptographically independent from the JWT signing key itself.
const encryptionKey = crypto.scryptSync(JWT_SECRET, "qillin-provider-key-encryption-v1", 32);

/** Encrypt a plaintext secret for storage. Returns a versioned, self-contained string. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt a value previously produced by encryptSecret. Values that are not
 * in the versioned format are returned unchanged — this covers plaintext
 * rows written before encryption was introduced, so existing data keeps
 * working until it's next rewritten (at which point it gets encrypted).
 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext
  const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
