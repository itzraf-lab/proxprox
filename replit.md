# Qillin — AI Proxy Platform

Qillin is a self-hosted AI proxy: one API key, every LLM. It routes requests to OpenAI, Anthropic, and any OpenAI-compatible endpoint, enforcing per-user credit (Qredit) budgets and logging spend — without storing message content.

## Architecture

```
Browser → React frontend (port 5000)
              └─► Express API server (port 8080)
                     ├─► SQLite  (apps/api-server/data/qillin.db)
                     └─► LiteLLM proxy (127.0.0.1:8000, internal)
                            ├─► Upstream AI providers
                            └─► PostgreSQL (LiteLLM virtual keys & spend)
```

## Running on Replit

Three workflows must all be running:

| Workflow | Command | Notes |
|----------|---------|-------|
| **LiteLLM Proxy** | `PATH=.venv/bin:$PATH python apps/litellm-proxy/start.py` | Takes 60–90 s to start; binds to 127.0.0.1:8000 |
| **API Server** | `pnpm --filter @workspace/api-server run dev` | Port 8080; builds then starts |
| **Start application** | `PORT=5000 pnpm --filter @workspace/qillin-web run dev` | Vite frontend on port 5000 (Replit webview) |

Start them in this order: LiteLLM Proxy → API Server → Start application.

## Required Secrets

Set these in Replit Secrets:

| Secret | Purpose |
|--------|---------|
| `LITELLM_MASTER_KEY` | Master key for LiteLLM admin API |
| `JWT_SECRET` | Signs user JWTs (min 32 chars) |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |

`DATABASE_URL` is automatically provided by Replit's managed PostgreSQL.

## Project Layout

```
apps/
  litellm-proxy/   Python LiteLLM proxy (start.py, config.yaml, .venv/)
  api-server/      Express API (auth, admin, proxy gateway, SQLite)
  web/             React + Vite dashboard
packages/
  api-spec/        OpenAPI spec + Orval codegen
  api-zod/         Generated Zod schemas
  api-client-react/ Generated React Query hooks
```

## Development Commands

```bash
# Install / reinstall all deps
pnpm install
uv pip install --python apps/litellm-proxy/.venv -r apps/litellm-proxy/requirements.txt

# Type-check everything
pnpm run typecheck

# Regenerate API client after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

## User Preferences

- Use pnpm (not npm/yarn) for Node package management
- Use uv (not pip directly) for Python package management
- Python venv lives at apps/litellm-proxy/.venv (Python 3.12)
- Do not set a global PORT env var — pass PORT=5000 only in the web workflow command
