---
name: better-sqlite3 build approval
description: better-sqlite3 must be in onlyBuiltDependencies and build.mjs external list.
---

`better-sqlite3` is a native Node.js addon that requires compilation. Without approval it silently skips the native build and fails at runtime.

**Why:** pnpm's security model blocks build scripts by default. The compiled `.node` binary is required for the module to load.

**How to apply:**
1. Add `better-sqlite3` to `onlyBuiltDependencies` in `pnpm-workspace.yaml` (already done).
2. Add `better-sqlite3` to the `external` array in `artifacts/api-server/build.mjs` so esbuild doesn't bundle the native module (already done).
3. After adding, run `pnpm install --no-frozen-lockfile` to trigger the native build.
