# Qillin — local development on Linux.
# See HOW_TO_RUN.md for prerequisites and full details.

SHELL := /bin/bash
VENV := apps/litellm-proxy/.venv
PY := $(VENV)/bin/python
# Prefix that loads .env into a recipe's shell.
LOAD_ENV := set -a; [ -f .env ] && . ./.env; set +a;

.PHONY: help install setup-python db-setup typecheck build proxy api web dev

help:
	@echo "Qillin targets:"
	@echo "  make install       Install Node deps (pnpm) + Python venv for LiteLLM"
	@echo "                     (uses uv if available, else system python3 + pip)"
	@echo "  make db-setup      Create the local PostgreSQL role + database for LiteLLM"
	@echo "  make typecheck     Typecheck all packages"
	@echo "  make build         Typecheck + build all packages"
	@echo "  make proxy         Run the LiteLLM proxy      (port 8000)"
	@echo "  make api           Run the Express API server (port 8080)"
	@echo "  make web           Run the React frontend     (port 5173)"
	@echo "  make dev           Run all three services together"

# ── Setup ────────────────────────────────────────────────────────────────
install: setup-python
	pnpm install

# Creates/updates the LiteLLM venv. Fast path: uv (manages Python 3.13 for you).
# Without uv: falls back to the system python3 + venv + pip, so any machine with
# a stock Python 3.10+ works. On Debian/Ubuntu that requires the python3-venv
# apt package (otherwise `python3 -m venv` cannot bootstrap pip).
setup-python:
	@if command -v uv >/dev/null 2>&1; then \
		echo ">> uv detected — setting up LiteLLM venv with uv (Python 3.13)"; \
		test -d $(VENV) || uv venv --python 3.13 $(VENV); \
		uv pip install --python $(VENV) -r apps/litellm-proxy/requirements.txt; \
	elif [ -d $(VENV) ] && $(PY) -c 'import litellm, prisma, uvicorn' >/dev/null 2>&1; then \
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
