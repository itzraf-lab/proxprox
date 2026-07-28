# How to Run Qillin (Linux)

Qillin is a self-hosted AI proxy platform made of three processes that run
simultaneously:

| Process | What it does | Port |
|---------|-------------|------|
| **LiteLLM proxy** | Routes AI requests to upstream providers | 8000 (internal) |
| **API server** | Express app — auth, admin, data, proxy gateway | 8080 |
| **Web frontend** | React dashboard (Vite dev server) | 5173 |

In dev, the web server proxies `/api` and `/v1` to the API server, so the whole
app is reachable from a single origin (`http://localhost:5173`).

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 24+ | e.g. the official tarball, `nvm`, or your distro |
| pnpm | 10+ | `corepack enable pnpm` (ships with Node) |
| Python | 3.13+ | e.g. [`uv`](https://docs.astral.sh/uv/): `uv python install 3.13` |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| PostgreSQL | 14+ | `sudo apt-get install postgresql` (LiteLLM's internal tables) |
| Build toolchain | — | `sudo apt-get install build-essential` (for `better-sqlite3`) |

> **Why PostgreSQL?** LiteLLM requires PostgreSQL for virtual-key and spend
> tracking — SQLite is not supported by LiteLLM. Qillin's own app data (users,
> providers, models) lives in a separate SQLite file via `better-sqlite3`.

---

## 1. Clone

```bash
git clone <your-repo-url>
cd proxprox
```

## 2. Configure environment

```bash
cp .env.example .env
# then edit .env — set LITELLM_MASTER_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET
```

## 3. Install dependencies

```bash
make install      # pnpm install + a Python venv for LiteLLM (apps/litellm-proxy/.venv)
```

`better-sqlite3` is a native module and is compiled during `pnpm install`
(needs `build-essential`).

## 4. Create the PostgreSQL database

```bash
make db-setup     # creates role "qillin" and database "qillin_litellm"
```

This matches the default `DATABASE_URL` in `.env.example`. If you use your own
PostgreSQL user/database, update `DATABASE_URL` in `.env` instead.

## 5. Run the three services

Either run them together:

```bash
make dev          # starts proxy + api + web; Ctrl-C stops all of them
```

…or run each in its own terminal (all from the repo root):

```bash
make proxy        # LiteLLM proxy  → http://localhost:8000
make api          # API server     → http://localhost:8080
make web          # Web frontend   → http://localhost:5173
```

The LiteLLM proxy takes ~30–60 s on first start (Prisma generate + DB
migrations). The API server creates `apps/api-server/data/qillin.db` and seeds
the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on first run.

## 6. Log in

Open `http://localhost:5173` and sign in with the `ADMIN_EMAIL` /
`ADMIN_PASSWORD` from your `.env`.

From the dashboard you can:
- Add AI providers (OpenAI, Anthropic, custom OpenAI-compatible endpoints)
- Create models and enable them for users
- Issue API keys and manage user Qredit balances

---

## Making API calls

Once a user has a Qillin API key, they can call models through the proxy using
any OpenAI-compatible client:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="sk-qillin-...",
)

response = client.chat.completions.create(
    model="your-model-display-name",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

---

## Project layout

```
apps/
  litellm-proxy/   Python LiteLLM proxy (start.py, config.yaml, callback)
  api-server/      Express API server (auth, admin, proxy gateway, SQLite)
  web/             React + Vite dashboard
packages/
  api-spec/        OpenAPI spec (source of truth) + Orval codegen
  api-zod/         Generated Zod schemas
  api-client-react/  Generated React Query client
```

## Architecture overview

```
Browser
  └─► React frontend (5173)
         │  (dev server proxies /api and /v1)
         └─► Express API server (8080)
                ├─► SQLite  (apps/api-server/data/qillin.db)  — app data
                └─► LiteLLM proxy (127.0.0.1:8000, internal)
                       ├─► Upstream AI provider (OpenAI, Anthropic, …)
                       └─► PostgreSQL  — LiteLLM virtual keys & spend
```

The API server also receives POST callbacks from LiteLLM after every successful
AI call (`/api/internal/litellm-event`) to deduct Qredits and record activity.

---

## Useful commands

```bash
make typecheck    # typecheck every package
make build        # typecheck + build every package
pnpm --filter @workspace/api-spec run codegen   # regenerate API client after editing openapi.yaml
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `better-sqlite3` build error | Missing C++ toolchain | `sudo apt-get install build-essential` |
| "AI proxy is starting up" on chat | LiteLLM not fully started yet | Wait ~60 s after `make proxy`, then retry |
| LiteLLM fails to start | `DATABASE_URL` unset or PostgreSQL unreachable | Check the connection string; ensure PostgreSQL is running (`pg_lsclusters`) |
| `JWT_SECRET ... required` on API start | Missing secret | Set `JWT_SECRET` in `.env` |
| Admin account not created | `ADMIN_EMAIL`/`ADMIN_PASSWORD` missing | Set them in `.env` before starting the API server |
| 403 "user not allowed to access model" | Wrong model identifier in allowlist | In the admin panel, use the model's display name, not the internal `litellm_model` value |
