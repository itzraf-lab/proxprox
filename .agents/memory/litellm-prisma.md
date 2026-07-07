---
name: LiteLLM prisma generate
description: Must run prisma generate with LiteLLM's bundled schema before first proxy start.
---

LiteLLM bundles its own Prisma schema at `.pythonlibs/lib/python3.13/site-packages/litellm/proxy/schema.prisma`. Before starting the proxy for the first time, `prisma generate` must be run against this schema.

**Why:** LiteLLM's PrismaClient initialization throws "Unable to find Prisma binaries. Please run 'prisma generate' first." without it.

**How to apply:** The `litellm-proxy/start.py` script runs `prisma generate --schema <path>` automatically before launching. On cold start this adds ~5 seconds. Prisma migrations (already applied) show "No pending migrations" on subsequent starts.

**Startup time:** First cold start takes ~40s (Prisma generate + migration check + LiteLLM startup). Configure the Replit workflow with `portOpenTimeout: 120` to avoid premature failure marking.
