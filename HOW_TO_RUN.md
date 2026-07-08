# How to Run Qillin Locally

Qillin is a self-hosted AI proxy platform with three processes you need running simultaneously:

| Process | What it does | Port |
|---------|-------------|------|
| **LiteLLM proxy** | Routes AI requests to upstream providers | 8000 (internal) |
| **API server** | Express app — auth, admin, data, proxy gateway | 8080 |
| **Web frontend** | React dashboard | 5173 (Vite default) |

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 24+ |
| pnpm | 10+ (`npm install -g pnpm`) |
| Python | 3.13+ |
| PostgreSQL | 14+ (for LiteLLM's internal tables) |

---

## 1. Clone and fix platform overrides

```bash
git clone <your-repo-url>
cd qillin
```

> ⚠️ **macOS / Windows users:** `pnpm-workspace.yaml` excludes all non-Linux binaries for esbuild, rollup, and Tailwind CSS (a Replit size-optimization). You must remove or comment out those `overrides` blocks or `pnpm install` will fail.
>
> Open `pnpm-workspace.yaml` and delete every line that ends in `"-"` under `overrides:`. Keep the rest.

---

## 2. Install Node dependencies

```bash
pnpm install
```

`better-sqlite3` is a native module — pnpm will compile it automatically because it is listed in `onlyBuiltDependencies`. Make sure you have a C++ build toolchain available (`build-essential` on Linux, Xcode Command Line Tools on macOS).

---

## 3. Install Python dependencies

```bash
pip install "litellm[proxy]>=1.91.0" "prisma>=0.15.0" "uvicorn>=0.50.2"
```

Then run a one-time Prisma schema generation (LiteLLM needs its own Prisma client):

```bash
prisma generate --schema "$(pip show litellm | grep Location | awk '{print $2}')/litellm/proxy/schema.prisma"
```

On macOS you can also get the path with:
```bash
python3 -c "import litellm; import os; print(os.path.join(os.path.dirname(litellm.__file__), 'proxy', 'schema.prisma'))"
```

---

## 4. Create a PostgreSQL database

LiteLLM requires PostgreSQL for virtual key and spend tracking — SQLite is **not** supported by LiteLLM itself.

```sql
CREATE DATABASE qillin_litellm;
```

Your `DATABASE_URL` will look like:
```
postgresql://user:password@localhost:5432/qillin_litellm
```

---

## 5. Set environment variables

Create a `.env` file in the repo root **or** export each variable in your shell. The API server and LiteLLM both read from the environment.

```bash
# .env (or export in your shell)

# Required
LITELLM_MASTER_KEY=sk-your-secret-master-key-here   # any random string; keep it secret
ADMIN_EMAIL=admin@example.com                         # email for the initial admin account
ADMIN_PASSWORD=your-admin-password                    # set once; can be changed in the UI later
JWT_SECRET=your-jwt-secret-at-least-32-chars          # signs user tokens; keep it secret
DATABASE_URL=postgresql://user:password@localhost:5432/qillin_litellm

# Optional
ADMIN_USERNAME=Admin                     # display name for the admin account (default: Eruu)
LITELLM_URL=http://localhost:8000        # where the API server finds LiteLLM
LITELLM_PORT=8000                        # which port LiteLLM listens on
QILLIN_INTERNAL_URL=http://localhost:8080  # where LiteLLM's callback POSTs usage data
SESSION_SECRET=your-session-secret       # used by session middleware
```

> **Tip:** Use a tool like [`direnv`](https://direnv.net/) or [`dotenv-cli`](https://github.com/entropitor/dotenv-cli) to load `.env` automatically. The app does not auto-load `.env` files — you must source them or prefix commands.

---

## 6. Start the three services

Open **three terminal tabs** (all from the repo root, with env vars loaded).

### Tab 1 — LiteLLM proxy

The `start.py` script has Replit-specific paths. Run LiteLLM directly instead:

```bash
litellm --port 8000 --host 127.0.0.1 --config litellm-proxy/config.yaml
```

Wait for the line:
```
INFO:     Application startup complete.
```
LiteLLM takes about 30–60 seconds to fully start the first time (it applies DB migrations).

### Tab 2 — API server

```bash
pnpm --filter @workspace/api-server run dev
```

On first run this creates `artifacts/api-server/data/qillin.db` and seeds the admin account using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Tab 3 — Web frontend

```bash
pnpm --filter @workspace/qillin-web run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

---

## 7. Log in

Navigate to the frontend URL and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set.

From the dashboard you can:
- Add AI providers (OpenAI, Anthropic, custom OpenAI-compatible endpoints, etc.)
- Create models and enable them for users
- Issue API keys and manage user Qredit balances

---

## Making API calls

Once a user has been issued a Qillin API key, they can call models through the proxy using any OpenAI-compatible client:

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

## Architecture overview

```
Browser
  └─► React frontend (port 5173)
         └─► Express API server (port 8080)
                ├─► SQLite  (artifacts/api-server/data/qillin.db)  — app data
                └─► LiteLLM proxy (localhost:8000, internal only)
                       └─► Upstream AI provider (OpenAI, Anthropic, etc.)
                       └─► PostgreSQL  — LiteLLM virtual keys & spend tracking
```

The API server also receives POST callbacks from LiteLLM after every successful AI call to deduct Qredits and record activity.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `pnpm install` fails with missing binary | Platform overrides exclude your OS | Remove the `"-"` entries in `pnpm-workspace.yaml` overrides |
| `better-sqlite3` build error | Missing C++ toolchain | `apt install build-essential` (Linux) or `xcode-select --install` (macOS) |
| "AI proxy is starting up" on chat | LiteLLM not fully started yet | Wait ~60 s after starting LiteLLM, then retry |
| 403 "user not allowed to access model" | User's model allowlist uses wrong identifier | In admin panel, set allowed models using the display name (e.g. `deepseek-v4-pro`), not the internal `litellm_model` value |
| LiteLLM fails to start | `DATABASE_URL` not set or PostgreSQL unreachable | Check the connection string and that PostgreSQL is running |
| Admin account not created | `ADMIN_EMAIL` or `ADMIN_PASSWORD` not in env | Verify env vars are exported before starting the API server |
