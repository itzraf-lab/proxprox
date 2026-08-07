#!/usr/bin/env bash
# update.sh — update every Qillin dependency to its latest version.
#
#   Node.js packages : `pnpm update --latest` across the whole workspace,
#                      including the shared catalog in pnpm-workspace.yaml
#   Python packages  : litellm[proxy], prisma, uvicorn (apps/litellm-proxy/.venv)
#
# After updating, the workspace is type-checked so breakage from upstream
# changes surfaces immediately.
#
# Notes:
#   - pnpm-workspace.yaml enforces minimumReleaseAge (a release must be at
#     least 1 day old), so "latest" means "latest that is ≥ 1 day old".
#   - react / react-dom are pinned in the catalog on purpose; this script
#     restores those pins after the bulk update.
#   - Everything the script changes is tracked by git (package.json files,
#     pnpm-workspace.yaml, pnpm-lock.yaml), so you can roll back with:
#         git restore package.json pnpm-workspace.yaml pnpm-lock.yaml '*/package.json'

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="apps/litellm-proxy/.venv"
REQ="apps/litellm-proxy/requirements.txt"

# ── Output helpers ───────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi
step() { printf '\n%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%sERROR:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

command -v pnpm >/dev/null 2>&1 || die "pnpm not found. Run ./scripts/setup.sh (or 'make install') first."

# ── 1. Node.js dependencies ──────────────────────────────────────────────
step "Updating Node.js dependencies (pnpm update --latest --recursive)"

# react / react-dom are pinned in the pnpm catalog on purpose (see the comment
# in pnpm-workspace.yaml). Capture the pins now so they can be restored after
# the bulk update — `pnpm update --latest` would otherwise bump them too.
catalog_pin() { awk -v key="$1:" '$1 == key { print $2; exit }' pnpm-workspace.yaml; }
REACT_PIN="$(catalog_pin react)"
REACT_DOM_PIN="$(catalog_pin react-dom)"

pnpm update --latest --recursive

restore_pin() {
  local name="$1" pin="$2" current
  [ -n "$pin" ] || return 0
  current="$(catalog_pin "$name")"
  if [ -n "$current" ] && [ "$current" != "$pin" ]; then
    sed -i -E "s|^  ${name}: [^ ]*|  ${name}: ${pin}|" pnpm-workspace.yaml
    warn "Kept ${name} pinned at ${pin} (intentional — see pnpm-workspace.yaml)"
  fi
}
restore_pin react "$REACT_PIN"
restore_pin react-dom "$REACT_DOM_PIN"

# Settle the lockfile in case a pin was restored.
pnpm install
ok "Node.js dependencies updated"

# ── 2. Python dependencies (LiteLLM proxy) ───────────────────────────────
step "Updating Python dependencies (LiteLLM, prisma, uvicorn)"

if [ ! -x "$VENV/bin/python" ]; then
  warn "$VENV not found — creating it first (make setup-python)."
  make setup-python
fi

if command -v uv >/dev/null 2>&1; then
  uv pip install --python "$VENV" --upgrade -r "$REQ"
else
  "$VENV/bin/python" -m pip install --upgrade -r "$REQ"
fi

LITELLM_VERSION="$("$VENV/bin/python" -c 'from importlib.metadata import version; print(version("litellm"))' 2>/dev/null || echo "unknown")"
ok "Python dependencies updated (litellm $LITELLM_VERSION)"

# ── 3. Verify ────────────────────────────────────────────────────────────
step "Verifying the workspace still type-checks"
if pnpm run typecheck; then
  ok "Type-check passed"
else
  die "Type-check FAILED after the update. Review the errors above — you may
need to adapt code to upstream breaking changes, or roll back with:
    git restore package.json pnpm-workspace.yaml pnpm-lock.yaml '*/package.json'"
fi

step "Done"
cat <<EOF
All dependencies are up to date.
  • The LiteLLM proxy re-runs 'prisma generate' automatically on its next start.
  • Restart the services to use the new versions: make dev
EOF
