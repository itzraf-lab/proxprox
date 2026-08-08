#!/usr/bin/env bash
# update.sh — update Qillin: optionally pull the latest code, then update every
# dependency to its latest version.
#
#   Code (optional)  : `git pull --ff-only` (--pull)
#   Node.js packages : `pnpm update --latest` across the whole workspace,
#                      including the shared catalog in pnpm-workspace.yaml
#   Python packages  : litellm[proxy], prisma, uvicorn (apps/litellm-proxy/.venv)
#
# Before touching anything, a preflight verifies the required tools exist and
# that the machine has enough disk/RAM headroom for the update + type-check.
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

source "$ROOT/scripts/check.sh"

VENV="apps/litellm-proxy/.venv"
REQ="apps/litellm-proxy/requirements.txt"

# ── Options ──────────────────────────────────────────────────────────────
DO_PULL=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: ./scripts/update.sh [options]

Updates all Qillin dependencies to their latest versions, then type-checks
the workspace.

Options:
  --pull      First update the code itself with 'git pull --ff-only'
              (the typical "update the deployment on my VPS" path).
  --dry-run   Run the preflight checks and show what would be updated,
              without changing anything.
  -h, --help  Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --pull)    DO_PULL=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

# ── 0. Preflight: tools + headroom ───────────────────────────────────────
preflight() {
  step "Preflight checks"
  command -v node >/dev/null 2>&1 || die "node not found. Run ./scripts/setup.sh first."
  command -v pnpm >/dev/null 2>&1 || die "pnpm not found. Run ./scripts/setup.sh (or 'make install') first."
  command -v make >/dev/null 2>&1 || warn "make not found — needed only if the Python venv has to be rebuilt."
  if ! command -v git >/dev/null 2>&1; then
    if [ "$DO_PULL" -eq 1 ]; then die "git not found, cannot --pull. Install git (scripts/check.sh --install)."; fi
    warn "git not found — the rollback instructions below will not apply."
  fi

  sys_detect
  # Updating means a pnpm store fetch + new node_modules before the old one is
  # replaced, plus a full type-check (tsc peaks above 1 GB of RAM).
  if [ "$DISK_FREE_MB" -lt 512 ]; then
    die "Only $(mb_to_human "$DISK_FREE_MB") of disk free — an update needs at least 512 MB. Free space first."
  elif [ "$DISK_FREE_MB" -lt 1536 ]; then
    warn "Only $(mb_to_human "$DISK_FREE_MB") of disk free — the update should fit, but it will be tight."
  fi
  if [ "$MEM_TOTAL_MB" -lt "$REQ_MEM_REC" ] && [ "$SWAP_TOTAL_MB" -lt "$REQ_SWAP_MIN" ]; then
    warn "$(mb_to_human "$MEM_TOTAL_MB") RAM with no swap — the type-check step may be OOM-killed."
    warn "Re-run ./scripts/setup.sh to have a swapfile created automatically."
  fi
  ok "Preflight passed (node $(node -v), pnpm $(pnpm --version), $(mb_to_human "$DISK_FREE_MB") disk free)"
}

preflight

if [ "$DRY_RUN" -eq 1 ]; then
  cat <<EOF

Dry run — no changes made. A real run would:
  $([ "$DO_PULL" -eq 1 ] && echo "• git pull --ff-only" || echo "• (skip code pull — pass --pull to include it)")
  • pnpm update --latest --recursive   (respecting the react/react-dom pins)
  • pnpm install
  • upgrade Python packages from $REQ into $VENV
  • pnpm run typecheck               (fail ⇒ roll back, see notes above)
EOF
  exit 0
fi

PREV_HEAD="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# ── 1. Code (optional) ───────────────────────────────────────────────────
if [ "$DO_PULL" -eq 1 ]; then
  step "Pulling the latest code (git pull --ff-only)"
  git pull --ff-only || die "git pull --ff-only failed — resolve local changes/conflicts, then re-run."
  ok "Code updated ($(git rev-parse --short HEAD))"
fi

# ── 2. Node.js dependencies ──────────────────────────────────────────────
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

# ── 3. Python dependencies (LiteLLM proxy) ───────────────────────────────
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

# ── 4. Verify ────────────────────────────────────────────────────────────
step "Verifying the workspace still type-checks"
if pnpm run typecheck; then
  ok "Type-check passed"
else
  die "Type-check FAILED after the update. Review the errors above — you may
need to adapt code to upstream breaking changes, or roll back with:
    git restore package.json pnpm-workspace.yaml pnpm-lock.yaml '*/package.json'
(was at commit $PREV_HEAD before this run)"
fi

step "Done"
cat <<EOF
All dependencies are up to date.
  • The LiteLLM proxy re-runs 'prisma generate' automatically on its next start.
  • Restart the services to use the new versions: make dev   (or: make prod)
EOF
