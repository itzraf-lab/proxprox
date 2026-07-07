---
name: JWT secret fail-fast
description: JWT_SECRET must fail at module load time, not silently fall back to a hardcoded default.
---

`artifacts/api-server/src/lib/auth.ts` must throw at module load if `JWT_SECRET` is unset. A hardcoded fallback like `"qillin-dev-secret-change-in-production"` lets attackers forge valid tokens on misconfigured deployments.

**Why:** If a production deploy forgets the env var, a fallback secret is publicly known and allows full account compromise.

**How to apply:** Use a startup guard:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set.");
}
```
This causes the server process to exit immediately with a clear error, rather than run with a compromised auth system.
