---
name: Provider API key encryption at rest
description: How Qillin encrypts provider_api_keys.key_value in SQLite, and where it must be decrypted.
---

`provider_api_keys.key_value` is encrypted at rest (AES-256-GCM, versioned `enc:v1:` prefix) via
`artifacts/api-server/src/lib/crypto.ts`. The key is derived from `JWT_SECRET` via scrypt with a
fixed purpose string — no separate secret needed, but it means rotating `JWT_SECRET` also
invalidates stored provider keys (they'd need re-entry).

**Why:** provider API keys (OpenAI/Anthropic/etc credentials) were previously stored plaintext in
SQLite — an at-rest exposure risk found during a security audit.

**How to apply:** any new code path that reads or writes `provider_api_keys.key_value` must call
`encryptSecret()` before INSERT and `decryptSecret()` before using the value (masking for display,
or passing as `apiKey` to LiteLLM). `decryptSecret()` transparently passes through legacy
plaintext values (no `enc:v1:` prefix) so old rows keep working until rewritten. Known call sites:
`routes/admin.ts` (provider CRUD, model CRUD, masking) and `lib/sync.ts` (startup model sync).
