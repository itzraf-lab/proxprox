#!/usr/bin/env bash
# bootstrap.sh — set up Qillin on a VPS that has NOTHING installed yet.
#
# This is the zero-tooling entry point: it needs only a base OS with a
# package manager. It installs git + curl, clones the repo, then hands off
# to scripts/setup.sh (which does the real work: system check, swap,
# Node.js, pnpm, uv, PostgreSQL, .env, dependencies).
#
# Usage:
#   curl -fsSL <raw-url>/scripts/bootstrap.sh | bash -s -- <git-clone-url> [dir] [setup-flags...]
#   wget -qO-  <raw-url>/scripts/bootstrap.sh | bash -s -- <git-clone-url> [dir] [setup-flags...]
#
#   <git-clone-url>   e.g. https://github.com/you/proxprox.git (required)
#   [dir]             clone target (default: proxprox)
#   [setup-flags...]  anything else is passed through to scripts/setup.sh
#                     (e.g. --with-nginx, --skip-db)
#
# Environment:
#   BRANCH=<name>     clone a specific branch/tag (default: remote HEAD)
#
# If no URL is given but the current directory already contains the repo,
# bootstrap simply runs its scripts/setup.sh.

set -euo pipefail

if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi
info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%sERROR:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

usage() { sed -n '2,26p' "$0"; exit "${1:-0}"; }

# ── Args ─────────────────────────────────────────────────────────────────
REPO_URL="${1:-}"
if [ "$REPO_URL" = "-h" ] || [ "$REPO_URL" = "--help" ]; then usage 0; fi
if [ -n "$REPO_URL" ]; then shift; fi
DIR="${1:-proxprox}"
[ $# -gt 0 ] && shift
SETUP_ARGS=("$@")

# Already inside a clone? Just hand off to setup.
if [ -z "$REPO_URL" ]; then
  if [ -x ./scripts/setup.sh ]; then
    info "No clone URL given — using the repo in the current directory."
    exec ./scripts/setup.sh "${SETUP_ARGS[@]}"
  fi
  warn "No git clone URL given."
  usage 1
fi

# ── Privileges ───────────────────────────────────────────────────────────
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi
if [ -n "$SUDO" ] && ! command -v sudo >/dev/null 2>&1; then
  die "Need root or sudo to install git. Re-run as root."
fi
# Prime sudo when it requires a password. bootstrap is often piped in via
# curl|bash (stdin is the script stream, not a terminal), so ask on /dev/tty.
if [ -n "$SUDO" ] && ! sudo -n true 2>/dev/null; then
  if [ -t 0 ]; then
    sudo -v || die "sudo authentication failed."
  elif [ -r /dev/tty ]; then
    sudo -v < /dev/tty || die "sudo authentication failed."
  else
    die "sudo requires a password but there is no terminal to ask on. Run 'sudo -v' first, then re-run."
  fi
fi

# ── Package manager → git + curl ─────────────────────────────────────────
PM=""
for pm in apt-get dnf yum pacman zypper; do
  if command -v "$pm" >/dev/null 2>&1; then PM="$pm"; break; fi
done
[ -n "$PM" ] || die "No supported package manager (apt-get/dnf/yum/pacman/zypper). Install git manually, then run scripts/setup.sh."

install_prereqs() {
  info "Installing git + curl with $PM..."
  case "$PM" in
    apt-get) $SUDO env DEBIAN_FRONTEND=noninteractive apt-get update -qq \
             && $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y git curl ca-certificates ;;
    dnf)     $SUDO dnf install -y git curl ca-certificates ;;
    yum)     $SUDO yum install -y git curl ca-certificates ;;
    pacman)  $SUDO pacman -Sy --needed --noconfirm git curl ca-certificates ;;
    zypper)  $SUDO zypper --non-interactive install --no-recommends git curl ca-certificates ;;
  esac
}
command -v git >/dev/null 2>&1 && command -v curl >/dev/null 2>&1 || install_prereqs
command -v git >/dev/null 2>&1 || die "git is still missing after the install attempt."
ok "git $(git --version | awk '{print $3}') ready"

# ── Clone (or update an existing clone) ──────────────────────────────────
clone_args=("$REPO_URL" "$DIR")
[ -n "${BRANCH:-}" ] && clone_args=(--branch "$BRANCH" "${clone_args[@]}")

if [ -d "$DIR/.git" ]; then
  info "$DIR already cloned — pulling the latest changes..."
  git -C "$DIR" pull --ff-only || warn "git pull failed (local changes?) — continuing with what is on disk."
elif [ -e "$DIR" ]; then
  die "$DIR exists but is not a git clone. Remove it or pick another target directory."
else
  info "Cloning $REPO_URL → $DIR ..."
  git clone "${clone_args[@]}"
fi
ok "Repo ready in $DIR"

# ── Hand off to the real setup ───────────────────────────────────────────
info "Starting Qillin setup..."
exec "$DIR/scripts/setup.sh" ${SETUP_ARGS[@]+"${SETUP_ARGS[@]}"}
