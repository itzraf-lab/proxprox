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

## Quick setup (recommended)

Everything below is automated — including on a **barebones VPS with nothing
installed**. Pick one of three entry points:

**0. Truly empty machine** (no git yet) — one line installs git, clones, and
runs the full setup:

```bash
curl -fsSL <raw-url>/scripts/bootstrap.sh | bash -s -- <your-repo-url>
# e.g. curl -fsSL https://raw.githubusercontent.com/you/proxprox/main/scripts/bootstrap.sh \
#        | bash -s -- https://github.com/you/proxprox.git
```

**1. Normal path** — clone, then run the setup script:

```bash
git clone <your-repo-url>
cd proxprox
./scripts/setup.sh      # or: make setup
make dev                # start all three services
```

On a truly minimal image even `make` may be missing — `./scripts/setup.sh`
works regardless (it installs `make` as part of the build tools); use
`make setup` only when `make` already exists.

**2. Just checking a machine** — detect the hardware, list which dependencies
are present/missing, and get a verdict on whether the spec is enough, without
changing anything:

```bash
./scripts/check.sh              # or: make check  (add --install to fix what's missing)
./scripts/setup.sh --check-only # same, through the setup entry point
```

`setup.sh` works with `apt-get`, `dnf`, `yum`, `pacman` and `zypper`. It:
detects the system and prints a spec verdict (step 0), installs system
packages (build tools, git, curl, Python 3, PostgreSQL), **creates a swapfile
automatically when RAM is low** (without one, a ~2 GB VPS gets its LiteLLM
proxy OOM-killed), installs Node.js 24 into `~/.local` (persisting PATH to
your shell profile), enables pnpm, installs uv, provisions the PostgreSQL
database, writes a `.env` with freshly generated secrets (the admin password
is printed at the end), and installs all Node + Python dependencies. It is
idempotent — safe to re-run after a failure.

Options: `--check-only` (detect + report, change nothing), `--skip-system`
(don't install system packages or Node — verify only), `--skip-db` (don't
provision PostgreSQL, e.g. when using a remote `DATABASE_URL`), `--skip-swap`
(never create a swapfile), `--with-nginx` (also install nginx + certbot with
its nginx plugin, for production), `--help`.

Prefer to do it by hand? Follow the manual steps below.

---

## System requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| CPU | 1 core | 2 cores | 1 core works; builds/typecheck are slow |
| RAM | 1.8 GB **+ 2 GB swap** | 4 GB | LiteLLM alone peaks near 800 MB; without swap it gets OOM-killed on small VPSes. `setup.sh` creates the swapfile for you |
| Disk | 3 GB free | 6 GB free | ~1.5 GB for deps + toolchain, plus PostgreSQL and logs |
| OS | Linux with `apt-get`, `dnf`/`yum`, `pacman` or `zypper` | Ubuntu 24.04 | x86_64 or aarch64 (for the automated Node.js install) |

`./scripts/check.sh` measures all of the above and prints a verdict
(exit code 2 = below minimum, so it can gate automation).

## Prerequisites

Everything in this table is installed by `setup.sh`; listed here for the
manual path:

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 24+ | e.g. the official tarball, `nvm`, or your distro |
| pnpm | 10+ | `corepack enable pnpm` (ships with Node) |
| Python | 3.13+ | e.g. [`uv`](https://docs.astral.sh/uv/): `uv python install 3.13` |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| PostgreSQL | 14+ | `sudo apt-get install postgresql` (LiteLLM's internal tables) |
| Build toolchain | — | `sudo apt-get install build-essential` (for `better-sqlite3`) |
| git, curl, tar, xz, openssl | — | installed by `setup.sh` / your package manager |

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

## Production mode

The Vite dev server on :5173 is fine for development, but for a real deployment
run:

```bash
make prod
```

This is a single command that:

1. Typechecks and builds everything (`make build`) — the React app lands in
   `apps/web/dist/public` and the API server compiles to
   `apps/api-server/dist/`.
2. Rewrites the nginx sites that previously proxied to the Vite dev server
   (`app` and `qillin`, originals backed up to `<site>.dev-bak`) so nginx
   serves the static frontend directly and proxies `/api` + `/v1` to the API
   server on :8080 — then validates with `nginx -t` and reloads. Requires
   sudo. To redo just this step later: `make prod-nginx`.
   On a fresh VPS where none of those sites exist yet, `prod-nginx` instead
   installs a catch-all site (`server_name _`, replacing the stock nginx
   `default` site) so production works out of the box.
3. Starts the LiteLLM proxy (:8000) and the compiled API server (:8080) with
   `NODE_ENV=production`. Ctrl-C stops both; the frontend needs no process at
   all.

After `make prod`, the app is available on port 80 (no :5173 involved). Code
changes require re-running `make prod` so the static build is regenerated —
unlike `make dev`, there is no hot reload.

### HTTPS

With a DNS record pointing at the server, one command adds TLS (the nginx
plugin for certbot is installed by `setup.sh --with-nginx`):

```bash
sudo certbot --nginx -d your.domain.example   # then re-run: make prod-nginx
```

certbot needs port 80 reachable from the internet for validation. Afterwards,
`make prod-nginx` detects the certificate at
`/etc/letsencrypt/live/<domain>/` and regenerates the site from
`scripts/nginx-prod-ssl.conf` instead, so redeploys keep HTTPS and the
HTTP → HTTPS redirect. Renewal is automatic via certbot's scheduled task.

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

## Updating to the latest versions

```bash
make update                 # or: ./scripts/update.sh
make update ARGS='--pull'   # also git-pull the latest code first (typical VPS update)
```

A preflight runs first: it verifies the required tools are present and that
the machine has enough disk (≥ 512 MB) and memory headroom for the update and
the final type-check. `--dry-run` shows the plan without changing anything.

The update itself bumps **everything** to its latest version:

- Node.js packages via `pnpm update --latest` across the workspace (including
  the shared catalog in `pnpm-workspace.yaml`)
- The LiteLLM proxy's Python packages (`litellm[proxy]`, `prisma`, `uvicorn`)

Afterwards it type-checks the workspace so breakage from upstream changes
surfaces immediately. Notes:

- `react`/`react-dom` stay pinned, as documented in `pnpm-workspace.yaml`.
- `minimumReleaseAge` still applies: "latest" means the newest release that is
  at least 1 day old (supply-chain protection).
- The LiteLLM proxy re-runs `prisma generate` automatically on its next start;
  restart the services (`make dev`) to use the new versions.
- Everything the script touches is tracked by git — roll back with
  `git restore package.json pnpm-workspace.yaml pnpm-lock.yaml '*/package.json'`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| A service (usually `litellm`) dies with no error, `dmesg` shows "Out of memory: Killed process" | Not enough RAM and no swap | Re-run `./scripts/setup.sh` — it creates a `/swapfile` automatically on low-RAM machines. Verify with `swapon --show`; prefer `make prod` over `make dev` under 4 GB RAM |
| `better-sqlite3` build error | Missing C++ toolchain | `sudo apt-get install build-essential` |
| "AI proxy is starting up" on chat | LiteLLM not fully started yet | Wait ~60 s after `make proxy`, then retry |
| LiteLLM fails to start | `DATABASE_URL` unset or PostgreSQL unreachable | Check the connection string; ensure PostgreSQL is running (`pg_lsclusters`) |
| LiteLLM crashes with `ImportError: cannot import name 'get_flat_dependant'` | The venv has fastapi ≥ 0.140.7, which removed a private symbol litellm 1.95.0 imports | Re-run `make setup-python` — the pin in `apps/litellm-proxy/requirements.txt` restores a compatible fastapi |
| `JWT_SECRET ... required` on API start | Missing secret | Set `JWT_SECRET` in `.env` |
| Admin account not created | `ADMIN_EMAIL`/`ADMIN_PASSWORD` missing | Set them in `.env` before starting the API server |
| 403 "user not allowed to access model" | Wrong model identifier in allowlist | In the admin panel, use the model's display name, not the internal `litellm_model` value |
