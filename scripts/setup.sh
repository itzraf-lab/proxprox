#!/usr/bin/env bash
# setup.sh — one-command setup for Qillin on a barebones Linux VPS.
#
# Works on a machine with nothing installed but a base OS. In order it:
#   0. Detects the system (CPU/RAM/swap/disk/OS) and checks whether the spec
#      is enough to run the server   [scripts/check.sh]
#   1. Installs system packages: build tools, git, curl, Python 3, sudo if
#      missing, PostgreSQL          — apt-get / dnf / yum / pacman / zypper
#   2. Creates a /swapfile when RAM is low (a 1.9 GB VPS otherwise OOM-kills
#      the LiteLLM proxy)
#   3. Ensures Node.js 24+ (official tarball into ~/.local, PATH persisted
#      to your shell profile)
#   4. Enables pnpm via Corepack
#   5. Installs uv (manages Python 3.13 for the LiteLLM venv)
#   6. Starts PostgreSQL and creates the qillin role + qillin_litellm database
#   7. Writes .env with freshly generated secrets (skipped if .env exists)
#   8. Installs Node + Python dependencies (make install)
#   9. Optionally installs nginx + certbot for 'make prod' (--with-nginx)
#
# The script is idempotent: completed steps are detected and skipped, so it is
# safe to re-run after a failure. Re-checking the machine without changing
# anything: ./scripts/setup.sh --check-only (or ./scripts/check.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Logging helpers, package-manager + hardware detection, ensure_swap,
# check_dependencies and friends.
source "$ROOT/scripts/check.sh"

# ── Options ──────────────────────────────────────────────────────────────
SKIP_SYSTEM=0
SKIP_DB=0
SKIP_SWAP=0 # read by ensure_swap (check.sh)
WITH_NGINX=0
CHECK_ONLY=0

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [options]

Sets up Qillin on a fresh, barebones Linux VPS:
  system check → system packages → swap (if low RAM) → Node.js 24 → pnpm
  → uv → PostgreSQL → .env → dependencies

Options:
  --check-only   Only detect the system + dependencies and print the spec
                 verdict. Installs nothing, changes nothing.
  --skip-system  Do not install system packages or a local Node.js toolchain;
                 only verify that the required tools exist.
  --skip-db      Do not install or provision PostgreSQL (e.g. you will point
                 DATABASE_URL at a remote database instead).
  --skip-swap    Do not create a swapfile, even when RAM is low (not
                 recommended — the LiteLLM proxy gets OOM-killed without it).
  --with-nginx   Also install nginx + certbot for production serving
                 (see 'make prod' and the HTTPS section of HOW_TO_RUN.md).
  -h, --help     Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --check-only)  CHECK_ONLY=1 ;;
    --skip-system) SKIP_SYSTEM=1 ;;
    --skip-db)     SKIP_DB=1 ;;
    --skip-swap)   SKIP_SWAP=1 ;;
    --with-nginx)  WITH_NGINX=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

NODE_INSTALLED_LOCALLY=0
GENERATED_ADMIN_PASSWORD=""

# ── 0. System detection + spec verdict ───────────────────────────────────
print_system_report
check_dependencies
spec_verdict || warn "Continuing anyway — the steps above explain what is too small and how to fix it."

if [ "$CHECK_ONLY" -eq 1 ]; then
  [ "$SPEC_STATUS" != fail ] || exit 2
  exit 0
fi

# Prime sudo once, up front, when it requires a password. Without this, the
# first $SUDO call deep inside the run would stall an unattended setup on a
# hidden password prompt (or fail outright when stdin is a pipe, e.g. via
# bootstrap.sh). Root and passwordless sudo skip this entirely.
if [ "$(id -u)" -ne 0 ] && [ "$HAS_SUDO" -eq 1 ] && ! sudo -n true 2>/dev/null; then
  info "This setup needs sudo for system packages and PostgreSQL."
  if [ -t 0 ]; then
    sudo -v || die "sudo authentication failed."
  elif [ -r /dev/tty ]; then
    sudo -v < /dev/tty || die "sudo authentication failed."
  else
    die "sudo requires a password but there is no terminal to ask on.
Run 'sudo -v' first (or re-run from an interactive shell), then re-run this script."
  fi
fi

# ── 1. System packages ───────────────────────────────────────────────────
install_system_deps() {
  if [ "$SKIP_SYSTEM" -eq 1 ]; then
    info "Skipping system package installation (--skip-system)"
    return
  fi
  step "System packages (build tools, git, curl, Python 3$([ "$SKIP_DB" -eq 1 ] || echo ', PostgreSQL'))"
  local extra=()
  [ "$SKIP_DB" -eq 1 ] || extra+=(postgresql)
  install_base_packages "${extra[@]}"
}

# ── 2. Swap (low-RAM safety net) ─────────────────────────────────────────
# A 1.9 GB VPS OOM-kills the LiteLLM proxy (peaks near 800 MB RSS) the first
# time several services run at once. ensure_swap is a no-op when swap or
# enough RAM is already there.
setup_swap() {
  if [ "$SKIP_SYSTEM" -eq 1 ]; then return; fi
  step "Swap check"
  ensure_swap || warn "Proceeding without swap — watch for OOM kills ('sudo dmesg | grep -i oom')."
}

# ── 3. Node.js 24+ ───────────────────────────────────────────────────────
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
  case "$ARCH" in
    x86_64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) die "Unsupported CPU architecture: $ARCH. Install Node.js 24+ manually from https://nodejs.org" ;;
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
  persist_path
  ok "Installed $(node -v) to $dest"
}

# Put ~/.local/bin on PATH permanently so future shells find node/pnpm/uv.
# Idempotent: the marker block is only appended once per profile file.
persist_path() {
  local marker="# >>> qillin toolchain (added by scripts/setup.sh) >>>"
  local line='export PATH="$HOME/.local/bin:$PATH"'
  local profile
  for profile in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    # .bashrc is always written; the others only when they already exist.
    if [ "$profile" = "$HOME/.bashrc" ] || [ -f "$profile" ]; then
      if ! grep -qF "$marker" "$profile" 2>/dev/null; then
        printf '\n%s\n%s\n# <<< qillin toolchain <<<\n' "$marker" "$line" >> "$profile"
        info "Added ~/.local/bin to PATH in $profile"
      fi
    fi
  done
}

# ── 4. pnpm (via Corepack) ───────────────────────────────────────────────
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
  # Corepack would otherwise ask interactively before downloading pnpm, which
  # hangs a non-interactive setup run.
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  command -v pnpm >/dev/null 2>&1 || die "pnpm is still not on PATH after 'corepack enable'."
  pnpm --version >/dev/null 2>&1 || die "pnpm shim exists but could not fetch pnpm. Check your network connection."
  ok "pnpm $(pnpm --version)"
}

# ── 5. uv (Python package manager) ───────────────────────────────────────
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

# ── 6. PostgreSQL ────────────────────────────────────────────────────────
ensure_postgres() {
  if [ "$SKIP_DB" -eq 1 ]; then
    info "Skipping PostgreSQL setup (--skip-db) — point DATABASE_URL in .env at your database."
    return
  fi
  step "PostgreSQL (role qillin, database qillin_litellm)"
  command -v psql >/dev/null 2>&1 \
    || die "psql not found. Install PostgreSQL 14+ (or drop --skip-db / --skip-system)."

  local pg_major
  pg_major="$(psql_major)"
  if [ -n "$pg_major" ] && [ "$pg_major" -lt 14 ]; then
    warn "PostgreSQL $pg_major is older than 14 — LiteLLM migrations may fail."
    warn "Upgrade PostgreSQL (e.g. the official PostgreSQL apt/yum repo) and re-run."
  fi

  # Fedora/RHEL, SUSE and Arch need an explicit initdb; Debian/Ubuntu packages
  # initialize and start a cluster automatically.
  if { [ "$PM" = "dnf" ] || [ "$PM" = "yum" ]; } && [ ! -d /var/lib/pgsql/data/base ]; then
    info "Initializing the PostgreSQL data directory ($PM)..."
    $SUDO postgresql-setup --initdb \
      || as_postgres initdb --locale=C.UTF-8 -E UTF8 -D /var/lib/pgsql/data \
      || warn "initdb failed — initialize PostgreSQL manually."
  elif [ "$PM" = "zypper" ] && [ ! -d /var/lib/pgsql/data/base ]; then
    info "Initializing the PostgreSQL data directory (zypper)..."
    as_postgres initdb --locale=C.UTF-8 -E UTF8 -D /var/lib/pgsql/data \
      || warn "initdb failed — initialize PostgreSQL manually."
  elif [ "$PM" = "pacman" ] && [ ! -d /var/lib/postgres/data/base ]; then
    info "Initializing the PostgreSQL data directory (pacman)..."
    as_postgres initdb --locale=C.UTF-8 -E UTF8 -D /var/lib/postgres/data \
      || warn "initdb failed — initialize PostgreSQL manually."
  fi

  if [ "$HAS_SYSTEMD" -eq 1 ]; then
    $SUDO systemctl enable --now postgresql 2>/dev/null \
      || warn "Could not start PostgreSQL via systemctl. Trying 'service'..."
  fi
  if ! pg_isready -q 2>/dev/null; then
    $SUDO service postgresql start 2>/dev/null || true
  fi

  info "Creating the qillin role and qillin_litellm database (idempotent)..."
  if ! as_postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
    die "Cannot reach PostgreSQL as the postgres superuser. Make sure the server
is running (e.g. 'sudo systemctl start postgresql') and re-run this script."
  fi
  make db-setup
  ok "PostgreSQL database ready (role: qillin, db: qillin_litellm)"
}

# ── 7. .env ──────────────────────────────────────────────────────────────
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

# ── 8. Dependencies ──────────────────────────────────────────────────────
install_deps() {
  command -v make >/dev/null 2>&1 || die "make not found. Install your distro's build tools and re-run."
  step "Node.js + Python dependencies (make install)"
  info "This can take a few minutes (better-sqlite3 is compiled from source)."
  make install
  ok "Dependencies installed"
}

# ── 9. nginx (optional, production) ──────────────────────────────────────
install_nginx() {
  if [ "$WITH_NGINX" -eq 0 ]; then return; fi
  step "nginx + certbot (--with-nginx)"
  # nginx/certbot live in /usr/sbin — on Debian that directory is not on a
  # non-root PATH, so probe the well-known locations too (pm_install maps
  # 'certbot' to certbot + the nginx plugin package).
  if command -v nginx >/dev/null 2>&1 || [ -x /usr/sbin/nginx ]; then
    ok "nginx already installed"
  else
    pm_install nginx || warn "Could not install nginx — install it manually before 'make prod'."
  fi
  if command -v certbot >/dev/null 2>&1 || [ -x /usr/bin/certbot ]; then
    ok "certbot already installed (with the nginx plugin)"
  else
    pm_install certbot || warn "Could not install certbot — only needed for HTTPS; see HOW_TO_RUN.md."
  fi
  info "Site config is applied by 'make prod' (see the Production section of HOW_TO_RUN.md)."
}

# ── Run ──────────────────────────────────────────────────────────────────
install_system_deps
setup_swap
ensure_node
ensure_pnpm
ensure_uv
ensure_postgres
setup_env
install_deps
install_nginx

# ── Summary ──────────────────────────────────────────────────────────────
printf '\n%s%s\n' "$C_GREEN" "════════════════ Qillin setup complete ════════════════$C_RESET"
if [ "$NODE_INSTALLED_LOCALLY" -eq 1 ]; then
  cat <<'EOF'

Node.js was installed into ~/.local and your shell profile was updated.
Open a new shell (or run 'source ~/.bashrc') so plain 'node'/'pnpm' work.
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
sys_detect
if [ "$MEM_TOTAL_MB" -lt "$REQ_MEM_REC" ]; then
  cat <<EOF

Note: this machine has $(mb_to_human "$MEM_TOTAL_MB") RAM — below the
recommended $(mb_to_human $REQ_MEM_REC). Prefer 'make prod' over 'make dev'
(the Vite dev server is the most memory-hungry piece), and keep an eye on
'sudo dmesg | grep -i oom' if a service dies unexpectedly.
EOF
fi
cat <<'EOF'

Next steps:
    make dev        # start proxy + API + web together (development)
    make prod       # production: static frontend via nginx + compiled API
    make update     # later: update all deps (LiteLLM, npm packages, ...)
    make check      # re-run the system + dependency check at any time

Then open http://localhost:5173 (dev) and sign in with the admin account.
See HOW_TO_RUN.md for details and troubleshooting.
EOF
