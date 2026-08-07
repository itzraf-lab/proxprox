#!/usr/bin/env bash
# setup.sh — one-command setup for Qillin on Linux.
#
# What it does, in order:
#   1. Installs system packages (build tools, curl, PostgreSQL) — apt/dnf/pacman
#   2. Ensures Node.js 24+ (installs an official tarball into ~/.local if needed)
#   3. Enables pnpm via Corepack
#   4. Installs uv (Python package manager) if missing
#   5. Starts PostgreSQL and creates the qillin role + qillin_litellm database
#   6. Writes .env with freshly generated secrets (skipped if .env exists)
#   7. Installs Node + Python dependencies (make install)
#
# The script is idempotent: completed steps are detected and skipped, so it is
# safe to re-run after a failure.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Options ──────────────────────────────────────────────────────────────
SKIP_SYSTEM=0
SKIP_DB=0

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [options]

Sets up Qillin on a fresh Linux machine:
  system packages → Node.js 24 → pnpm → uv → PostgreSQL → .env → dependencies

Options:
  --skip-system   Do not install system packages or a local Node.js toolchain;
                  only verify that the required tools exist.
  --skip-db       Do not install or provision PostgreSQL (e.g. you will point
                  DATABASE_URL at a remote database instead).
  -h, --help      Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --skip-system) SKIP_SYSTEM=1 ;;
    --skip-db) SKIP_DB=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

# ── Output helpers ───────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi
info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%sERROR:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

# User-local tools (uv, a local Node install) land here — put it on PATH for
# this session right away.
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

PKG=""
for pm in apt-get dnf pacman; do
  if command -v "$pm" >/dev/null 2>&1; then PKG="$pm"; break; fi
done

NODE_INSTALLED_LOCALLY=0
GENERATED_ADMIN_PASSWORD=""

# ── 1. System packages ───────────────────────────────────────────────────
install_system_deps() {
  if [ "$SKIP_SYSTEM" -eq 1 ]; then
    info "Skipping system package installation (--skip-system)"
    return
  fi
  if [ -z "$PKG" ]; then
    warn "No supported package manager found (apt-get/dnf/pacman)."
    warn "Install these yourself, then re-run: a C/C++ build toolchain, curl,"
    warn "xz, and PostgreSQL 14+."
    return
  fi
  if [ -n "$SUDO" ] && ! command -v sudo >/dev/null 2>&1; then
    die "sudo is required to install system packages. Re-run as root or use --skip-system."
  fi

  info "Installing system packages with $PKG (build tools, curl, PostgreSQL)..."
  case "$PKG" in
    apt-get)
      $SUDO apt-get update -qq
      $SUDO apt-get install -y build-essential curl ca-certificates xz-utils postgresql
      ;;
    dnf)
      $SUDO dnf install -y gcc gcc-c++ make curl ca-certificates xz postgresql-server postgresql
      ;;
    pacman)
      $SUDO pacman -Sy --needed --noconfirm base-devel curl ca-certificates xz postgresql
      ;;
  esac
  ok "System packages installed"
}

# ── 2. Node.js 24+ ───────────────────────────────────────────────────────
node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }

ensure_node() {
  local major
  major="$(node_major)"
  if [ -n "$major" ] && [ "$major" -ge 24 ]; then
    ok "Node.js $(node -v) already installed"
    return
  fi
  if [ "$SKIP_SYSTEM" -eq 1 ]; then
    die "Node.js 24+ is required (found: $(node -v 2>/dev/null || echo none)). Install it and re-run."
  fi

  local arch
  case "$(uname -m)" in
    x86_64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) die "Unsupported CPU architecture: $(uname -m). Install Node.js 24+ manually from https://nodejs.org" ;;
  esac

  info "Installing Node.js 24 (official tarball, checksum-verified) into ~/.local ..."
  local tmp tarball_name
  tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" \
    || die "Could not download the Node.js release index. Check your network connection."
  tarball_name="$(awk -v suffix="linux-${arch}.tar.xz" '$2 ~ suffix "$" { print $2; exit }' "$tmp/SHASUMS256.txt")"
  [ -n "$tarball_name" ] || die "Could not find a Node.js 24 linux-${arch} tarball in the release index."
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/$tarball_name" -o "$tmp/$tarball_name" \
    || die "Could not download $tarball_name."
  (cd "$tmp" && grep " $tarball_name\$" SHASUMS256.txt | sha256sum -c - >/dev/null) \
    || die "Checksum verification failed for $tarball_name."

  mkdir -p "$HOME/.local/opt" "$HOME/.local/bin"
  tar -xJf "$tmp/$tarball_name" -C "$HOME/.local/opt"
  rm -rf "$tmp"

  local dest="$HOME/.local/opt/${tarball_name%.tar.xz}"
  local bin
  for bin in node npm npx corepack; do
    ln -sfn "$dest/bin/$bin" "$HOME/.local/bin/$bin"
  done
  hash -r
  NODE_INSTALLED_LOCALLY=1
  ok "Installed $(node -v) to $dest"
}

# ── 3. pnpm (via Corepack) ───────────────────────────────────────────────
ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    ok "pnpm $(pnpm --version) already available"
    return
  fi
  command -v corepack >/dev/null 2>&1 || die "corepack not found (it ships with Node.js). Reinstall Node.js 24+."

  info "Enabling pnpm via Corepack..."
  mkdir -p "$HOME/.local/bin"
  # Prefer a user-writable shim directory; fall back to the default location
  # next to the node binary (may need sudo for system-wide Node installs).
  if ! corepack enable --install-directory "$HOME/.local/bin" 2>/dev/null; then
    corepack enable 2>/dev/null || $SUDO corepack enable \
      || die "corepack enable failed. Run 'corepack enable' manually."
  fi
  hash -r
  command -v pnpm >/dev/null 2>&1 || die "pnpm is still not on PATH after 'corepack enable'."
  ok "pnpm $(pnpm --version)"
}

# ── 4. uv (Python package manager) ───────────────────────────────────────
ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    ok "uv $(uv --version | awk '{print $2}') already installed"
    return
  fi
  info "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh || die "uv installation failed."
  hash -r
  command -v uv >/dev/null 2>&1 || die "uv was installed but is not on PATH (expected in ~/.local/bin)."
  ok "uv $(uv --version | awk '{print $2}')"
}

# ── 5. PostgreSQL ────────────────────────────────────────────────────────
ensure_postgres() {
  if [ "$SKIP_DB" -eq 1 ]; then
    info "Skipping PostgreSQL setup (--skip-db)"
    return
  fi
  command -v psql >/dev/null 2>&1 \
    || die "psql not found. Install PostgreSQL 14+ (or drop --skip-db / --skip-system)."

  # Fedora/RHEL and Arch need an explicit initdb; Debian/Ubuntu packages
  # initialize and start a cluster automatically.
  if [ "$PKG" = "dnf" ] && [ ! -d /var/lib/pgsql/data/base ]; then
    info "Initializing the PostgreSQL data directory (dnf)..."
    $SUDO postgresql-setup --initdb || warn "postgresql-setup --initdb failed — initialize PostgreSQL manually."
  elif [ "$PKG" = "pacman" ] && [ ! -d /var/lib/postgres/data/base ]; then
    info "Initializing the PostgreSQL data directory (pacman)..."
    $SUDO -u postgres initdb --locale=C.UTF-8 -E UTF8 -D /var/lib/postgres/data \
      || warn "initdb failed — initialize PostgreSQL manually."
  fi

  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl enable --now postgresql 2>/dev/null \
      || warn "Could not start PostgreSQL via systemctl (no systemd?). Trying 'service'..."
  fi
  if ! pg_isready -q 2>/dev/null; then
    $SUDO service postgresql start 2>/dev/null || true
  fi

  info "Creating the qillin role and qillin_litellm database (idempotent)..."
  if ! $SUDO -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
    die "Cannot reach PostgreSQL as the postgres superuser. Make sure the server
is running (e.g. 'sudo systemctl start postgresql') and re-run this script."
  fi
  make db-setup
  ok "PostgreSQL database ready (role: qillin, db: qillin_litellm)"
}

# ── 6. .env ──────────────────────────────────────────────────────────────
gen_secret() { # $1 = number of random bytes → hex string of 2×$1 characters
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

setup_env() {
  if [ -f .env ]; then
    ok ".env already exists — leaving it untouched"
    if grep -q "change-me" .env; then
      warn ".env still contains default 'change-me' values — replace them before exposing Qillin to anyone."
    fi
    return
  fi

  info "Creating .env with freshly generated secrets..."
  cp .env.example .env
  local master_key jwt_secret admin_password
  master_key="sk-$(gen_secret 24)"
  jwt_secret="$(gen_secret 32)"
  admin_password="$(gen_secret 12)"
  sed -i \
    -e "s|^LITELLM_MASTER_KEY=.*|LITELLM_MASTER_KEY=$master_key|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$jwt_secret|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$admin_password|" \
    .env
  GENERATED_ADMIN_PASSWORD="$admin_password"
  ok ".env created"
}

# ── 7. Dependencies ──────────────────────────────────────────────────────
install_deps() {
  command -v make >/dev/null 2>&1 || die "make not found. Install your distro's build tools and re-run."
  info "Installing Node.js and Python dependencies (make install)..."
  info "This can take a few minutes (better-sqlite3 is compiled from source)."
  make install
  ok "Dependencies installed"
}

# ── Run ──────────────────────────────────────────────────────────────────
install_system_deps
ensure_node
ensure_pnpm
ensure_uv
ensure_postgres
setup_env
install_deps

# ── Summary ──────────────────────────────────────────────────────────────
printf '\n%s%s\n' "$C_GREEN" "════════════════ Qillin setup complete ════════════════$C_RESET"
if [ "$NODE_INSTALLED_LOCALLY" -eq 1 ]; then
  cat <<EOF

Node.js was installed into ~/.local. Make it permanent by adding this line
to your shell profile (~/.bashrc, ~/.zshrc, ...):

    export PATH="\$HOME/.local/bin:\$PATH"
EOF
fi
if [ -n "$GENERATED_ADMIN_PASSWORD" ]; then
  cat <<EOF

A .env file was created with random secrets. Your admin login:

    ADMIN_EMAIL=admin@example.com
    ADMIN_PASSWORD=$GENERATED_ADMIN_PASSWORD

Edit .env now if you want a different admin email/password — they are seeded
into the database on the API server's first start.
EOF
fi
cat <<'EOF'

Next steps:
    make dev        # start proxy + API + web together
    make update     # later: update all deps (LiteLLM, npm packages, ...)

Then open http://localhost:5173 and sign in with the admin account.
See HOW_TO_RUN.md for details and troubleshooting.
EOF
