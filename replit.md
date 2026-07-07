# Qillin

A self-hosted AI proxy platform for teams and developers — manage model access, track Qredit spend, configure providers, and issue API keys from a unified dashboard.

## Run & Operate

- `pnpm --filter @workspace/qillin-web run dev` — frontend (port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — Express API server (at `/api`)
- `python litellm-proxy/start.py` — LiteLLM proxy (port 8000, internal)
- `pnpm run typecheck` — full typecheck across all packages

## Required Secrets (set in Replit Secrets)

- `LITELLM_MASTER_KEY` — master key for LiteLLM admin API
- `ADMIN_PASSWORD` — admin account password (rotatable; updates the DB on each startup)
- `ADMIN_EMAIL` — admin account email address (e.g. `admin@example.com`)
- `JWT_SECRET` — secret for signing JWT auth tokens
- `DATABASE_URL` — auto-provided by Replit (PostgreSQL, used by LiteLLM)

## Non-Secret Env Vars

- `ADMIN_USERNAME` — admin display name (default: Eruu)
- `LITELLM_URL` — internal LiteLLM URL (default: http://localhost:8000)
- `LITELLM_PORT` — LiteLLM listen port (default: 8000)
- `LITELLM_DATABASE_URL` — LiteLLM DB (defaults to DATABASE_URL)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS 4 + Wouter (routing)
- API: Express 5 (at `/api`)
- DB (app data): SQLite via better-sqlite3 (stored in `./data/qillin.db`)
- DB (LiteLLM): PostgreSQL via Prisma (Replit's built-in, for LiteLLM internal data)
- Auth: JWT (HS256, 7-day expiry), stored in `localStorage` as `qillin_token`
- AI Proxy: LiteLLM proxy (Python, port 8000 internal)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)

## Currency

1 Qredit = $1 USD. All costs and balances shown in Qredits throughout the UI.

## Where Things Live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `artifacts/qillin-web/src/pages/` — all React pages
- `artifacts/qillin-web/src/lib/api.ts` — JWT token management + custom fetch
- `artifacts/api-server/src/db/index.ts` — SQLite setup + schema + admin seed
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/litellm.ts` — LiteLLM admin API client
- `litellm-proxy/config.yaml` — LiteLLM proxy config
- `data/qillin.db` — SQLite database (created at runtime)

## Architecture

```
Browser → Replit Proxy → React frontend (/)
                       → Express API (/api) → SQLite (qillin.db)
                                           → LiteLLM proxy (localhost:8000)
                       LiteLLM proxy (internal) → PostgreSQL (LiteLLM tables)
```

## Admin Access

- URL: `/login`
- Email: `eruu@qillin.local`
- Password: value of `ADMIN_PASSWORD` secret
- Role: admin (full access to `/admin/*` routes)

## Adding AI Providers

1. Log in as admin → Admin → Providers → Add Provider
2. Set name, type (openai/anthropic/custom), base URL (for custom)
3. Add API keys with labels and priorities (round-robin or priority-first)
4. Use "Fetch Models" to auto-discover available models from the provider

## User Preferences

- Admin username: Eruu
- Currency: Qredits (Qr), 1 Qredit = $1 USD
- Providers supported: OpenAI, Anthropic, custom 3rd-party (OpenAI-compatible API)
- Load balancing: round-robin or priority-first per provider

## Gotchas

- LiteLLM requires `prisma generate` before first start — the `start.py` handles this automatically
- LiteLLM requires PostgreSQL (not SQLite) for its virtual key/spend tracking features
- `better-sqlite3` is a native module — it must be in `onlyBuiltDependencies` in `pnpm-workspace.yaml` and in `external` in `build.mjs` (both already configured)
- After any `lib/api-spec/openapi.yaml` change, run `pnpm --filter @workspace/api-spec run codegen`
- The admin seed runs once on first API server startup if `ADMIN_PASSWORD` is set
- JWT tokens are not invalidated server-side (stateless); logout just clears localStorage
