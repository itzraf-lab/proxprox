# Qillin — local development on Linux.
# See HOW_TO_RUN.md for prerequisites and full details.

SHELL := /bin/bash
VENV := apps/litellm-proxy/.venv
PY := $(VENV)/bin/python
# Prefix that loads .env into a recipe's shell.
LOAD_ENV := set -a; [ -f .env ] && . ./.env; set +a;

.PHONY: help setup check update install setup-python db-setup typecheck build proxy api web dev prod prod-nginx

help:
	@echo "Qillin targets:"
	@echo "  make setup         One-command setup on a barebones Linux VPS (scripts/setup.sh)"
	@echo "                     Pass flags via ARGS, e.g. make setup ARGS='--with-nginx'"
	@echo "  make check         Detect hardware + dependencies, print a spec verdict"
	@echo "                     (scripts/check.sh; ARGS='--install' installs missing pkgs)"
	@echo "  make update        Update all deps to the latest versions (scripts/update.sh)"
	@echo "                     ARGS='--pull' also git-pulls the latest code first"
	@echo "  make install       Install Node deps (pnpm) + Python venv for LiteLLM"
	@echo "                     (uses uv if available, else system python3 + pip)"
	@echo "  make db-setup      Create the local PostgreSQL role + database for LiteLLM"
	@echo "  make typecheck     Typecheck all packages"
	@echo "  make build         Typecheck + build all packages"
	@echo "  make proxy         Run the LiteLLM proxy      (port 8000)"
	@echo "  make api           Run the Express API server (port 8080)"
	@echo "  make web           Run the React frontend     (port 5173)"
	@echo "  make dev           Run all three services together"
	@echo "  make prod          Production mode: build, point nginx at the static"
	@echo "                     frontend, run LiteLLM + the compiled API server"
	@echo "  make prod-nginx    Only (re)install the production nginx config"

# ── Setup ────────────────────────────────────────────────────────────────
# One-command setup for a barebones Linux VPS: detects the system (and tells
# you whether the spec is enough), installs system packages, creates a
# swapfile on low-RAM machines, then Node 24, pnpm, uv, PostgreSQL, .env with
# generated secrets, and all dependencies.
setup:
	./scripts/setup.sh $(ARGS)

# Report the machine's hardware + dependency status and whether the spec is
# sufficient. ARGS='--install' installs missing required packages.
check:
	./scripts/check.sh $(ARGS)

# Update all dependencies to their latest versions (Node + Python/LiteLLM),
# then type-check the workspace. ARGS='--pull' git-pulls the code first.
update:
	./scripts/update.sh $(ARGS)

install: setup-python
	pnpm install

# Creates/updates the LiteLLM venv. Fast path: uv (manages Python 3.13 for you).
# Without uv: falls back to the system python3 + venv + pip, so any machine with
# a stock Python 3.10+ works. On Debian/Ubuntu that requires the python3-venv
# apt package (otherwise `python3 -m venv` cannot bootstrap pip).
# The skip-check also probes fastapi.dependencies.utils.get_flat_dependant:
# litellm 1.95.0 needs that private symbol, which FastAPI removed in 0.140.7
# (see the pin in apps/litellm-proxy/requirements.txt). A venv created while an
# incompatible fastapi was installed fails the probe and gets re-provisioned
# instead of crashing the proxy at import time. Remove the probe when the pin
# is lifted.
setup-python:
	@if command -v uv >/dev/null 2>&1; then \
		echo ">> uv detected — setting up LiteLLM venv with uv (Python 3.13)"; \
		test -d $(VENV) || uv venv --python 3.13 $(VENV); \
		uv pip install --python $(VENV) -r apps/litellm-proxy/requirements.txt; \
	elif [ -d $(VENV) ] && $(PY) -c 'import litellm, prisma, uvicorn; from fastapi.dependencies.utils import get_flat_dependant' >/dev/null 2>&1; then \
		echo ">> $(VENV) already has the LiteLLM Python deps — skipping."; \
		echo "   To rebuild from scratch: rm -rf $(VENV) && make setup-python"; \
	else \
		echo ">> uv not found — falling back to system python3 + venv + pip"; \
		if [ ! -d $(VENV) ]; then \
			python3 -m venv $(VENV) || { \
				echo ">> standard venv creation failed (missing ensurepip?) — retrying with --without-pip"; \
				rm -rf $(VENV); \
				python3 -m venv --without-pip $(VENV) || { \
					echo "ERROR: could not create a virtualenv with python3."; \
					echo "On Debian/Ubuntu:  sudo apt-get install python3-venv"; \
					echo "Or install uv (manages Python for you):"; \
					echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"; \
					exit 1; \
				}; \
			}; \
		fi; \
		if ! $(PY) -m pip --version >/dev/null 2>&1; then \
			echo ">> pip missing inside the venv — bootstrapping with get-pip.py"; \
			curl -sSL https://bootstrap.pypa.io/get-pip.py | $(PY) - || { \
				echo "ERROR: could not bootstrap pip inside $(VENV)"; exit 1; }; \
		fi; \
		$(PY) -m pip install -r apps/litellm-proxy/requirements.txt; \
	fi

# Idempotent local PostgreSQL provisioning (role: qillin / db: qillin_litellm).
db-setup:
	sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='qillin'" | grep -q 1 || \
		sudo -u postgres psql -c "CREATE ROLE qillin LOGIN PASSWORD 'qillin';"
	sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='qillin_litellm'" | grep -q 1 || \
		sudo -u postgres psql -c "CREATE DATABASE qillin_litellm OWNER qillin;"

# ── Quality ──────────────────────────────────────────────────────────────
typecheck:
	pnpm run typecheck

build:
	pnpm run build

# ── Run (each in its own terminal) ─────────────────────────────────────────
proxy:
	$(LOAD_ENV) PATH="$(CURDIR)/$(VENV)/bin:$$PATH" $(PY) apps/litellm-proxy/start.py

api:
	$(LOAD_ENV) pnpm --filter @workspace/api-server run dev

web:
	$(LOAD_ENV) pnpm --filter @workspace/qillin-web run dev

# Run all three together; Ctrl-C stops the whole group.
dev:
	$(LOAD_ENV) trap 'kill 0' EXIT; \
		PATH="$(CURDIR)/$(VENV)/bin:$$PATH" $(PY) apps/litellm-proxy/start.py & \
		pnpm --filter @workspace/api-server run dev & \
		pnpm --filter @workspace/qillin-web run dev & \
		wait

# ── Production ─────────────────────────────────────────────────────────────
# nginx serves the built static frontend (apps/web/dist/public) and proxies
# /api + /v1 to the Express API on :8080 — same split as the Vite dev proxy,
# but with no dependency on the dev server staying alive.
WEB_DIST := apps/web/dist/public
NGINX_SITE_CONF := scripts/nginx-prod.conf
# Sites that currently proxy to the Vite dev server; prod-nginx rewrites them
# to serve the static build instead, keeping each site's server_name.
# Originals are backed up once to <site>.dev-bak.
NGINX_DEV_SITES := app qillin

# Full production bring-up: typecheck + build everything, install the nginx
# config, then run LiteLLM (:8000) and the compiled API server (:8080).
# The frontend needs no process — nginx serves it from disk. Ctrl-C stops both.
prod: build prod-nginx
	@echo ">> prod up: nginx :80 (static) -> api :8080 -> litellm :8000"
	$(LOAD_ENV) export NODE_ENV=production; trap 'kill 0' EXIT; \
		PATH="$(CURDIR)/$(VENV)/bin:$$PATH" $(PY) apps/litellm-proxy/start.py & \
		pnpm --filter @workspace/api-server run start & \
		wait

# Rewrites the dev nginx sites to serve $(WEB_DIST) directly. Needs sudo.
prod-nginx:
	@test -d $(WEB_DIST) || { \
		echo "ERROR: $(WEB_DIST) is missing — run 'make build' first (or just 'make prod')."; \
		exit 1; \
	}
	@for site in $(NGINX_DEV_SITES); do \
		conf=/etc/nginx/sites-available/$$site; \
		[ -f $$conf ] || continue; \
		server_name=$$(grep -oP 'server_name\s+\K[^;]+' $$conf | head -1 | xargs); \
		server_name=$${server_name:-_}; \
		template=$(NGINX_SITE_CONF); \
		if sudo test -f /etc/letsencrypt/live/$$server_name/fullchain.pem; then \
			template=scripts/nginx-prod-ssl.conf; \
			echo ">> found Let's Encrypt cert for $$server_name — keeping HTTPS"; \
		fi; \
		[ -f $$conf.dev-bak ] || sudo cp $$conf $$conf.dev-bak; \
		sed -e "s|@WEB_ROOT@|$(CURDIR)/$(WEB_DIST)|g" \
		    -e "s|@SERVER_NAME@|$$server_name|g" $$template \
			| sudo tee $$conf >/dev/null; \
		sudo ln -sf /etc/nginx/sites-available/$$site /etc/nginx/sites-enabled/$$site; \
		echo ">> $$conf now serves $(WEB_DIST) (previous config: $$conf.dev-bak)"; \
	done
	@# nginx workers (www-data) must traverse into the repo and read the build.
	@# o+x on each parent dir allows traversal without making ~ listable.
	@dir=$(CURDIR); while [ $$dir != / ]; do sudo chmod o+x $$dir || exit 1; dir=$$(dirname $$dir); done
	sudo chmod -R o+rX $(WEB_DIST)
	sudo nginx -t && sudo systemctl reload nginx
