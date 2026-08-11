#!/usr/bin/env bash
# check.sh — system detection & dependency checking for Qillin.
#
# Two ways to use this file:
#
#   1. Run it:   ./scripts/check.sh [--strict] [--install]
#      Prints a report of the machine's hardware (CPU/RAM/swap/disk), the OS,
#      and every tool Qillin needs, then a verdict on whether the spec is
#      enough to run the server.
#        --strict   exit non-zero when only the *recommended* spec is met
#        --install  install missing required packages via the system package
#                   manager (needs root or sudo)
#      Exit codes: 0 = meets minimum spec, 1 = below recommended (--strict),
#                  2 = below minimum spec.
#
#   2. Source it from another script (setup.sh / update.sh do this):
#        source "$(dirname "${BASH_SOURCE[0]}")/check.sh"
#      That provides the logging helpers (info/ok/warn/die/step), SUDO/PM,
#      sys_detect, print_system_report, spec_verdict, ensure_swap,
#      check_dependencies, install_base_packages, pm_install, and the
#      version helpers. Sourcing has no side effects beyond defining
#      functions/variables — nothing is detected or installed until a
#      function is called.
#
# Hardware thresholds (MB) are grounded in measured Qillin usage: the LiteLLM
# proxy alone peaks near 800 MB RSS, the Node build/typecheck spikes above
# 1 GB, and a full install (node_modules + Python venv + toolchain) takes
# ~1.5 GB of disk before PostgreSQL.

# ── Requirements (single source of truth — keep HOW_TO_RUN.md in sync) ────
REQ_CPU_MIN=1        # boots, but builds are painfully slow
REQ_CPU_REC=2
REQ_MEM_MIN=1800     # runs the stack IF swap is present
REQ_MEM_REC=3800     # comfortable without swap (a "4 GB" VPS reads ~3.7–4.0 GB)
REQ_SWAP_MIN=1536    # acceptable swap when RAM < REQ_MEM_REC
REQ_SWAP_AUTO_BELOW=3600  # setup.sh auto-creates swap when RAM is below this
REQ_DISK_MIN=3072    # hard floor: deps + build + database
REQ_DISK_REC=6144

# ── Output helpers (shared by every script that sources this file) ────────
if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""; C_RESET=""
fi
info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%sERROR:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
step() { printf '\n%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }

# User-local tools (uv, a local Node install) land here — make them visible.
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
# System binaries Qillin probes for (nginx, update-ca-certificates, swapon,
# runuser) live in sbin, which Debian leaves OUT of a non-root PATH — append
# it (last, so user tools still win) or detection reports false "missing".
case ":$PATH:" in
  *:/usr/sbin:*) ;;
  *) export PATH="$PATH:/usr/local/sbin:/usr/sbin:/sbin" ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Root / sudo ───────────────────────────────────────────────────────────
# SUDO is empty when running as root. HAS_SUDO records whether privilege
# escalation is possible at all (root, or sudo present).
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  HAS_SUDO=1
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
  HAS_SUDO=1
else
  SUDO="sudo"
  HAS_SUDO=0
fi

require_privileges() { # $1 = what needs them (for the error message)
  if [ "$HAS_SUDO" -eq 0 ]; then
    die "$1 needs root privileges, and neither root nor sudo is available.
Re-run as root, install sudo, or install the packages manually."
  fi
}

# ── Package manager detection ─────────────────────────────────────────────
# PM is one of: apt-get | dnf | yum | pacman | zypper | "" (unknown).
PM=""
for _pm in apt-get dnf yum pacman zypper; do
  if command -v "$_pm" >/dev/null 2>&1; then PM="$_pm"; break; fi
done
unset _pm
_PM_REFRESHED=0

pm_refresh() {
  [ "$_PM_REFRESHED" -eq 0 ] || return 0
  case "$PM" in
    apt-get) $SUDO env DEBIAN_FRONTEND=noninteractive apt-get update -qq ;;
    pacman)  ;; # -Sy happens on the install line
    zypper)  $SUDO zypper --non-interactive refresh >/dev/null ;;
    *)       ;; # dnf/yum refresh metadata automatically
  esac
  _PM_REFRESHED=1
}

# pm_install <generic-token>... — install packages, mapping generic tokens to
# per-distro package names. Tokens: ca-certificates curl wget git tar xz
# openssl sudo build-tools python3 python3-venv postgresql nginx certbot
# ('certbot' also pulls in the nginx plugin, so the documented
# 'sudo certbot --nginx -d …' works right after setup.)
pm_install() {
  [ "$#" -gt 0 ] || return 0
  if [ -z "$PM" ]; then
    warn "No supported package manager found (apt-get/dnf/yum/pacman/zypper)."
    warn "Install these yourself, then re-run: $*"
    return 1
  fi
  require_privileges "Installing system packages ($*)"

  local pkgs=() token
  for token in "$@"; do
    case "$PM:$token" in
      apt-get:build-tools)     pkgs+=(build-essential) ;;
      apt-get:python3-venv)    pkgs+=(python3-venv) ;;
      apt-get:xz)              pkgs+=(xz-utils) ;;
      dnf:build-tools|yum:build-tools)     pkgs+=(gcc gcc-c++ make) ;;
      dnf:python3-venv|yum:python3-venv)   pkgs+=(python3) ;; # venv is built in
      dnf:postgresql|yum:postgresql)       pkgs+=(postgresql-server postgresql) ;;
      pacman:build-tools)      pkgs+=(base-devel) ;;
      pacman:python3|pacman:python3-venv)  pkgs+=(python) ;;
      zypper:build-tools)      pkgs+=(gcc gcc-c++ make) ;;
      zypper:python3-venv)     pkgs+=(python3) ;;
      zypper:postgresql)       pkgs+=(postgresql-server postgresql) ;;
      # certbot alone can't run 'certbot --nginx' — the nginx plugin is a
      # separate package on Debian/RHEL/SUSE (bundled differently on Arch).
      apt-get:certbot)              pkgs+=(certbot python3-certbot-nginx) ;;
      dnf:certbot|yum:certbot)      pkgs+=(certbot python3-certbot-nginx) ;;
      pacman:certbot)               pkgs+=(certbot certbot-nginx) ;;
      zypper:certbot)               pkgs+=(certbot python3-certbot-nginx) ;;
      *)                       pkgs+=("$token") ;; # identical name everywhere
    esac
  done

  info "Installing system packages with $PM: ${pkgs[*]}"
  pm_refresh
  case "$PM" in
    apt-get) $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}" ;;
    dnf)     $SUDO dnf install -y "${pkgs[@]}" ;;
    yum)     $SUDO yum install -y "${pkgs[@]}" ;;
    pacman)  $SUDO pacman -Sy --needed --noconfirm "${pkgs[@]}" ;;
    zypper)  $SUDO zypper --non-interactive install --no-recommends "${pkgs[@]}" ;;
  esac
}

# ── System detection ──────────────────────────────────────────────────────
# Fills: OS_PRETTY ARCH CPU_CORES MEM_TOTAL_MB MEM_AVAIL_MB SWAP_TOTAL_MB
#        DISK_FREE_MB ROOT_FSTYPE HAS_SYSTEMD
sys_detect() {
  OS_PRETTY="$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-unknown Linux}" || uname -s)"
  ARCH="$(uname -m)"
  CPU_CORES="$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)"

  if [ -r /proc/meminfo ]; then
    MEM_TOTAL_MB=$(( $(awk '/^MemTotal:/ {print $2}' /proc/meminfo) / 1024 ))
    MEM_AVAIL_MB=$(( $(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) / 1024 ))
    SWAP_TOTAL_MB=$(( $(awk '/^SwapTotal:/ {print $2}' /proc/meminfo) / 1024 ))
  else # fallback for non-/proc environments
    MEM_TOTAL_MB=0; MEM_AVAIL_MB=0; SWAP_TOTAL_MB=0
  fi

  DISK_FREE_MB="$(df -Pm "$REPO_ROOT" 2>/dev/null | awk 'NR==2 {print $4}' || true)"
  DISK_FREE_MB="${DISK_FREE_MB:-0}"
  ROOT_FSTYPE="$(df --output=fstype "$REPO_ROOT" 2>/dev/null | awk 'NR==2 {print $1}' || true)"
  ROOT_FSTYPE="${ROOT_FSTYPE:-unknown}"

  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    HAS_SYSTEMD=1
  else
    HAS_SYSTEMD=0
  fi
}

mb_to_human() { # 1900 -> "1.9 GB"
  awk -v mb="$1" 'BEGIN { if (mb >= 1024) printf "%.1f GB", mb/1024; else printf "%d MB", mb }'
}

print_system_report() {
  sys_detect
  step "System detection"
  cat <<EOF
  OS        $OS_PRETTY ($ARCH)$([ "$HAS_SYSTEMD" -eq 1 ] || echo " — no systemd, service fallbacks will be used")
  CPU       $CPU_CORES core(s)
  RAM       $(mb_to_human "$MEM_TOTAL_MB") total, $(mb_to_human "$MEM_AVAIL_MB") available
  Swap      $(mb_to_human "$SWAP_TOTAL_MB")
  Disk      $(mb_to_human "$DISK_FREE_MB") free on $REPO_ROOT ($ROOT_FSTYPE)
  Pkg mgr   ${PM:-none detected}
EOF
}

# ── Spec verdict ──────────────────────────────────────────────────────────
# Prints the verdict and sets SPEC_STATUS: ok | warn | fail.
# Returns 0 when the minimum spec is met, 2 otherwise.
spec_verdict() {
  sys_detect
  SPEC_STATUS="ok"
  _downgrade() { # fail beats warn beats ok
    if [ "$1" = fail ] || { [ "$1" = warn ] && [ "$SPEC_STATUS" != fail ]; }; then
      SPEC_STATUS="$1"
    fi
  }

  step "Spec verdict (minimum: ${REQ_CPU_MIN} core / $(mb_to_human $REQ_MEM_MIN) RAM + swap / $(mb_to_human $REQ_DISK_MIN) disk — recommended: ${REQ_CPU_REC} cores / $(mb_to_human $REQ_MEM_REC) RAM / $(mb_to_human $REQ_DISK_REC) disk)"

  # RAM + swap: LiteLLM alone peaks near 800 MB; builds spike above 1 GB.
  if [ "$MEM_TOTAL_MB" -ge "$REQ_MEM_REC" ]; then
    ok "RAM $(mb_to_human "$MEM_TOTAL_MB") — meets the recommended spec"
  elif [ "$MEM_TOTAL_MB" -ge "$REQ_MEM_MIN" ]; then
    if [ "$SWAP_TOTAL_MB" -ge "$REQ_SWAP_MIN" ]; then
      _downgrade warn # above minimum, below the swap-free recommended spec
      ok "RAM $(mb_to_human "$MEM_TOTAL_MB") + $(mb_to_human "$SWAP_TOTAL_MB") swap — enough (this is the supported low-RAM configuration)"
    else
      _downgrade warn
      warn "RAM $(mb_to_human "$MEM_TOTAL_MB") is below the recommended $(mb_to_human $REQ_MEM_REC) and no swap is configured."
      warn "Without swap the OOM killer will eventually kill the LiteLLM proxy. setup.sh creates a swapfile automatically."
    fi
  elif [ $((MEM_TOTAL_MB + SWAP_TOTAL_MB)) -ge $((REQ_MEM_MIN + REQ_SWAP_MIN)) ]; then
    _downgrade warn
    warn "RAM $(mb_to_human "$MEM_TOTAL_MB") is below the minimum $(mb_to_human $REQ_MEM_MIN); swap is carrying the load. Expect slow builds; run 'make prod' rather than 'make dev'."
  else
    _downgrade fail
    warn "RAM $(mb_to_human "$MEM_TOTAL_MB") (+ $(mb_to_human "$SWAP_TOTAL_MB") swap) is not enough — Qillin needs at least $(mb_to_human $REQ_MEM_MIN) RAM backed by $(mb_to_human $REQ_SWAP_MIN) of swap."
  fi

  # CPU
  if [ "$CPU_CORES" -ge "$REQ_CPU_REC" ]; then
    ok "CPU $CPU_CORES cores — fine"
  else
    _downgrade warn
    warn "Only $CPU_CORES CPU core — the stack runs, but pnpm install / builds / typecheck will be slow."
  fi

  # Disk
  if [ "$DISK_FREE_MB" -ge "$REQ_DISK_REC" ]; then
    ok "Disk $(mb_to_human "$DISK_FREE_MB") free — fine"
  elif [ "$DISK_FREE_MB" -ge "$REQ_DISK_MIN" ]; then
    _downgrade warn
    warn "Disk $(mb_to_human "$DISK_FREE_MB") free — enough to install, tight for logs and updates ($(mb_to_human $REQ_DISK_REC) recommended)."
  else
    _downgrade fail
    warn "Disk $(mb_to_human "$DISK_FREE_MB") free — below the $(mb_to_human $REQ_DISK_MIN) minimum. Free space before installing."
  fi

  # Architecture (the Node.js tarball install supports x64/arm64)
  case "$ARCH" in
    x86_64|aarch64|arm64) ok "Architecture $ARCH — supported" ;;
    *) _downgrade warn
       warn "Architecture $ARCH — the automated Node.js install supports x86_64/aarch64 only. Install Node.js 24+ manually." ;;
  esac

  case "$SPEC_STATUS" in
    ok)   ok "Verdict: this machine meets the recommended spec." ;;
    warn) warn "Verdict: this machine meets the MINIMUM spec — usable, with the caveats above." ;;
    fail) warn "Verdict: this machine is BELOW the minimum spec — see the lines above." ;;
  esac
  [ "$SPEC_STATUS" != fail ]
}

# ── Swap ──────────────────────────────────────────────────────────────────
# Creates /swapfile when RAM is low and no swap exists. Idempotent: an
# active swapfile (or enough RAM) means there is nothing to do.
ensure_swap() {
  sys_detect
  if [ "$SWAP_TOTAL_MB" -ge "$REQ_SWAP_MIN" ]; then
    ok "Swap already configured ($(mb_to_human "$SWAP_TOTAL_MB"))"
    return 0
  fi
  if [ "$MEM_TOTAL_MB" -ge "$REQ_SWAP_AUTO_BELOW" ]; then
    return 0 # enough RAM that swap is optional
  fi
  if [ "${SKIP_SWAP:-0}" = 1 ]; then
    warn "Low RAM ($(mb_to_human "$MEM_TOTAL_MB")) with no swap, and --skip-swap was given."
    warn "The LiteLLM proxy is likely to be OOM-killed. Create swap manually (fallocate -l 2G /swapfile ...)."
    return 1
  fi
  require_privileges "Creating a swapfile"

  # Size: 3 GB below 2 GB RAM, 2 GB up to the auto threshold — capped so at
  # least 2 GB of disk stays free afterwards.
  local desired avail size
  if [ "$MEM_TOTAL_MB" -lt 2048 ]; then desired=3072; else desired=2048; fi
  avail=$((DISK_FREE_MB - 2048))
  size=$((desired < avail ? desired : avail))
  if [ "$size" -lt 1024 ]; then
    warn "Not enough free disk to create a useful swapfile (need $(mb_to_human $((desired + 2048))), have $(mb_to_human "$DISK_FREE_MB"))."
    return 1
  fi

  info "RAM is $(mb_to_human "$MEM_TOTAL_MB") with no swap — creating a $(mb_to_human $size) swapfile at /swapfile ..."
  if [ -f /swapfile ] && ! swapon --show=NAME --noheadings 2>/dev/null | grep -q '^/swapfile'; then
    warn "/swapfile exists but is not active — reusing it."
  else
    if [ "$ROOT_FSTYPE" = "btrfs" ]; then
      # btrfs swapfiles must be created NOCOW before any data is written.
      $SUDO touch /swapfile && $SUDO chattr +C /swapfile
    fi
    $SUDO fallocate -l "${size}M" /swapfile 2>/dev/null \
      || $SUDO dd if=/dev/zero of=/swapfile bs=1M count="$size" status=none \
      || die "Could not allocate /swapfile."
  fi
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null || die "mkswap /swapfile failed."
  $SUDO swapon /swapfile || die "swapon /swapfile failed."
  if ! grep -Eq '^[^#]*\/swapfile[[:space:]]' /etc/fstab 2>/dev/null; then
    echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  fi
  # Prefer keeping the working set in RAM; swap is only an OOM safety net.
  if [ -d /etc/sysctl.d ]; then
    echo 'vm.swappiness=10' | $SUDO tee /etc/sysctl.d/90-qillin-swap.conf >/dev/null
    $SUDO sysctl -q -w vm.swappiness=10 >/dev/null 2>&1 || true
  fi
  sys_detect
  ok "Swapfile active ($(mb_to_human "$SWAP_TOTAL_MB") total) and persisted in /etc/fstab"
}

# ── Dependency checking ───────────────────────────────────────────────────
# The version probes below are pure detection: a missing tool must yield an
# EMPTY result and a ZERO exit status. The trailing '|| true' is load-bearing —
# these run under 'set -euo pipefail' (setup.sh/update.sh), where a pipeline
# whose left side is a missing command (127) would otherwise abort the whole
# setup exactly when the machine is bare enough to need it.
node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true; }
psql_major() { psql --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true; }
python3_version() { python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true; }

# Run a command as the postgres OS user — as root via runuser (util-linux is
# Essential on every supported distro), as anyone else via sudo. Needed because
# '$SUDO -u postgres …' is broken when SUDO is empty (a root-only VPS).
as_postgres() {
  if [ "$(id -u)" -eq 0 ]; then
    if command -v runuser >/dev/null 2>&1; then
      runuser -u postgres -- "$@"
    else # last resort for minimal images without runuser
      su -s /bin/sh postgres -c "$(printf '%q ' "$@")"
    fi
  else
    require_privileges "Running commands as the postgres user"
    $SUDO -u postgres "$@"
  fi
}

# One row per tool: status + whether it is required. Fills MISSING_TOKENS
# with the pm_install tokens for everything required that is absent.
check_dependencies() {
  step "Dependency check"
  MISSING_TOKENS=()
  _row() { # $1 mark, $2 tool, $3 detail, $4 note
    printf '  %-2s %-10s %-36s %s\n' "$1" "$2" "$3" "$4"
  }
  _need() { # $1 token, $2 cmd, $3 note — present?
    if command -v "$2" >/dev/null 2>&1; then
      _row "$C_GREEN✓$C_RESET" "$2" "installed" "$3"
      return 0
    fi
    _row "$C_RED✗$C_RESET" "$2" "missing" "$3"
    MISSING_TOKENS+=("$1")
    return 1
  }

  info "Required system tools (installed via the package manager when missing):"
  _need git            git     "needed to clone/update the repo"        || true
  _need curl           curl    "needed to download Node.js / uv"        || true
  _need tar            tar     ""                                        || true
  _need xz             xz      "Node.js tarballs are .tar.xz"            || true
  _need build-tools    make    "compiles better-sqlite3"                 || true
  _need build-tools    gcc     "compiles better-sqlite3"                 || true
  if command -v update-ca-certificates >/dev/null 2>&1 || command -v update-ca-trust >/dev/null 2>&1; then
    _row "$C_GREEN✓$C_RESET" ca-certs "installed" "HTTPS to registries"
  else
    _row "$C_RED✗$C_RESET" ca-certs "missing" "HTTPS to registries"
    MISSING_TOKENS+=(ca-certificates)
  fi
  if ! command -v sudo >/dev/null 2>&1 && [ "$(id -u)" -ne 0 ]; then
    _row "$C_RED✗$C_RESET" sudo "missing" "needed for system packages + PostgreSQL provisioning"
    MISSING_TOKENS+=(sudo)
  else
    _row "$C_GREEN✓$C_RESET" sudo "present" ""
  fi

  info "Toolchain (setup.sh installs these into the user account when missing):"
  local nm
  nm="$(node_major)"
  if [ -n "$nm" ] && [ "$nm" -ge 24 ]; then
    _row "$C_GREEN✓$C_RESET" node "$(node -v)" ""
  elif [ -n "$nm" ]; then
    _row "$C_YELLOW!$C_RESET" node "$(node -v) — too old, need 24+" "setup.sh installs a local Node 24"
  else
    _row "$C_YELLOW!$C_RESET" node "missing" "setup.sh installs Node 24 into ~/.local"
  fi
  if command -v pnpm >/dev/null 2>&1; then _row "$C_GREEN✓$C_RESET" pnpm "$(pnpm --version 2>/dev/null)" ""
  else _row "$C_YELLOW!$C_RESET" pnpm "missing" "setup.sh enables it via Corepack"; fi
  if command -v uv >/dev/null 2>&1; then _row "$C_GREEN✓$C_RESET" uv "$(uv --version 2>/dev/null | awk '{print $2}')" ""
  else _row "$C_YELLOW!$C_RESET" uv "missing" "setup.sh installs it (manages Python 3.13)"; fi
  local pyv
  pyv="$(python3_version)"
  if [ -n "$pyv" ]; then _row "$C_GREEN✓$C_RESET" python3 "$pyv" "fallback for the LiteLLM venv when uv is absent"
  else _row "$C_YELLOW!$C_RESET" python3 "missing" "fallback for the LiteLLM venv; uv covers this too"; fi

  info "Services:"
  local pm
  pm="$(psql_major)"
  if [ -n "$pm" ]; then
    if [ "$pm" -ge 14 ]; then _row "$C_GREEN✓$C_RESET" psql "PostgreSQL $pm" ""
    else _row "$C_YELLOW!$C_RESET" psql "PostgreSQL $pm — older than 14" "LiteLLM may fail to migrate; upgrade PostgreSQL"; fi
  else
    _row "$C_YELLOW!$C_RESET" psql "missing" "setup.sh installs + provisions PostgreSQL (skip with --skip-db)"
  fi
  if command -v nginx >/dev/null 2>&1; then _row "$C_GREEN✓$C_RESET" nginx "$(nginx -v 2>&1 | grep -oE '[0-9.]+')" "optional — production frontend serving (make prod)"
  else _row "$C_DIM-$C_RESET" nginx "missing" "optional — only needed for 'make prod' on a VPS"; fi
}

# install_base_packages: everything from the package manager that Qillin's
# own setup steps rely on. Extra tokens can be appended (e.g. postgresql).
install_base_packages() {
  local tokens=(ca-certificates curl wget git tar xz openssl build-tools python3 python3-venv)
  # Root on a minimal image often has no sudo, and db-setup shells out to it.
  if ! command -v sudo >/dev/null 2>&1; then tokens+=(sudo); fi
  pm_install "${tokens[@]}" "$@"
  ok "Base system packages present"
}

# ── Standalone mode ───────────────────────────────────────────────────────
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail
  STRICT=0
  DO_INSTALL=0
  for arg in "$@"; do
    case "$arg" in
      --strict)  STRICT=1 ;;
      --install) DO_INSTALL=1 ;;
      -h|--help)
        sed -n '2,22p' "$0"
        exit 0 ;;
      *) die "Unknown option: $arg (try --help)" ;;
    esac
  done

  print_system_report
  check_dependencies
  spec_verdict || true # exit code decided below, after optional install

  if [ "$DO_INSTALL" -eq 1 ]; then
    # Drop duplicates, then install whatever the check found missing.
    if [ "${#MISSING_TOKENS[@]}" -gt 0 ]; then
      mapfile -t MISSING_TOKENS < <(printf '%s\n' "${MISSING_TOKENS[@]}" | sort -u)
      step "Installing missing packages"
      pm_install "${MISSING_TOKENS[@]}" || die "Some packages could not be installed — see above."
      ok "Missing packages installed — re-run ./scripts/check.sh to confirm."
    else
      ok "Nothing to install — all required packages are present."
    fi
  fi

  case "$SPEC_STATUS" in
    fail) exit 2 ;;
    warn) [ "$STRICT" -eq 1 ] && exit 1 || exit 0 ;;
    *)    exit 0 ;;
  esac
fi
