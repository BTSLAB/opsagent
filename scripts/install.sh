#!/usr/bin/env bash
# OpsAgent Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/BTSLAB/opsagent/main/scripts/install.sh | bash
#   or:  curl -fsSL https://raw.githubusercontent.com/BTSLAB/opsagent/main/scripts/install.sh | bash -s -- [OPTIONS]
#
# Options:
#   --beta              Install beta channel (npm dist-tag "beta")
#   --version <ver>     Install a specific version (e.g. 2026.1.25)
#   --install-method git  Clone from source instead of npm
#   --verbose           Show detailed output
#   --uninstall         Remove OpsAgent
#   --help              Show this help
#
# Requires: Node >= 22, npm

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────
PACKAGE="opsagent"
REPO="https://github.com/BTSLAB/opsagent.git"
MIN_NODE_MAJOR=22
CONFIG_DIR="${OPSAGENT_CONFIG_DIR:-$HOME/.opsagent}"

# ── Defaults ───────────────────────────────────────────────────────────
CHANNEL="latest"
VERSION=""
METHOD="git"
VERBOSE=false
UNINSTALL=false

# ── Colors ─────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD="\033[1m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  RED="\033[31m"
  CYAN="\033[36m"
  RESET="\033[0m"
else
  BOLD="" GREEN="" YELLOW="" RED="" CYAN="" RESET=""
fi

info()  { printf "${GREEN}▸${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}▸${RESET} %s\n" "$*"; }
err()   { printf "${RED}✘${RESET} %s\n" "$*" >&2; }
ok()    { printf "${GREEN}✔${RESET} %s\n" "$*"; }
banner() {
  printf "\n${BOLD}${CYAN}"
  cat <<'ART'
   ___              _                    _
  / _ \ _ __  ___  / \   __ _  ___ _ __ | |_
 | | | | '_ \/ __|| _ \ / _` |/ _ \ '_ \| __|
 | |_| | |_) \__ \| |_| | (_| |  __/ | | | |_
  \___/| .__/|___/|_| |_|\__, |\___|_| |_|\__|
       |_|               |___/
ART
  printf "${RESET}\n"
  printf "  ${BOLD}OpsAgent${RESET} — AI Operations Assistant by BTS Labs\n\n"
}

usage() {
  banner
  cat <<EOF
Usage: curl -fsSL https://raw.githubusercontent.com/BTSLAB/opsagent/main/scripts/install.sh | bash
   or: curl -fsSL https://raw.githubusercontent.com/BTSLAB/opsagent/main/scripts/install.sh | bash -s -- [OPTIONS]

Options:
  --beta                  Install beta channel
  --version <version>     Install a specific version (e.g. 2026.1.25)
  --install-method git    Clone from GitHub source
  --verbose               Verbose output
  --uninstall             Remove OpsAgent
  --help                  Show this help
EOF
  exit 0
}

# ── Parse args ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --beta)           CHANNEL="beta"; shift ;;
    --version)        VERSION="$2"; shift 2 ;;
    --install-method) METHOD="$2"; shift 2 ;;
    --verbose)        VERBOSE=true; shift ;;
    --uninstall)      UNINSTALL=true; shift ;;
    --help|-h)        usage ;;
    *)                err "Unknown option: $1"; usage ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────
command_exists() { command -v "$1" >/dev/null 2>&1; }

verbose() {
  if [[ "$VERBOSE" == true ]]; then
    printf "  ${CYAN}[debug]${RESET} %s\n" "$*"
  fi
}

check_node() {
  if ! command_exists node; then
    err "Node.js is not installed."
    echo ""
    echo "  Install Node >= $MIN_NODE_MAJOR from https://nodejs.org"
    echo "  or via nvm:  nvm install $MIN_NODE_MAJOR"
    echo ""
    exit 1
  fi

  local node_version
  node_version="$(node -v | sed 's/^v//')"
  local major="${node_version%%.*}"

  if [[ "$major" -lt "$MIN_NODE_MAJOR" ]]; then
    err "Node.js $node_version found — OpsAgent requires Node >= $MIN_NODE_MAJOR."
    echo ""
    echo "  Upgrade: nvm install $MIN_NODE_MAJOR"
    echo ""
    exit 1
  fi

  verbose "Node.js $node_version OK"
}

check_npm() {
  if ! command_exists npm; then
    err "npm is not installed. Install Node.js from https://nodejs.org"
    exit 1
  fi
  verbose "npm $(npm -v) OK"
}

# ── Uninstall ──────────────────────────────────────────────────────────
do_uninstall() {
  banner
  info "Uninstalling OpsAgent..."

  if command_exists opsagent; then
    # Stop gateway if running
    verbose "Stopping gateway (if running)..."
    pkill -f "opsagent-gateway" 2>/dev/null || true
    pkill -f "opsagent gateway" 2>/dev/null || true
  fi

  # npm global uninstall
  if npm ls -g "$PACKAGE" >/dev/null 2>&1; then
    info "Removing npm global package..."
    npm uninstall -g "$PACKAGE"
  fi

  # git install
  local git_dir="$HOME/opsagent"
  if [[ -d "$git_dir" && -d "$git_dir/.git" ]]; then
    info "Removing source checkout at $git_dir..."
    rm -rf "$git_dir"
  fi

  ok "OpsAgent uninstalled."
  echo ""
  warn "Config directory preserved at $CONFIG_DIR"
  echo "  Remove it manually: rm -rf $CONFIG_DIR"
  echo ""
  exit 0
}

# ── Install via npm ────────────────────────────────────────────────────
install_npm() {
  local pkg_spec="$PACKAGE"

  if [[ -n "$VERSION" ]]; then
    pkg_spec="${PACKAGE}@${VERSION}"
  elif [[ "$CHANNEL" == "beta" ]]; then
    pkg_spec="${PACKAGE}@beta"
  else
    pkg_spec="${PACKAGE}@latest"
  fi

  info "Installing $pkg_spec via npm..."
  verbose "npm install -g $pkg_spec"

  if [[ "$(id -u)" -eq 0 ]]; then
    npm install -g "$pkg_spec"
  else
    # Try without sudo first; fall back to sudo
    if npm install -g "$pkg_spec" 2>/dev/null; then
      true
    else
      warn "Global install needs elevated permissions — retrying with sudo..."
      sudo npm install -g "$pkg_spec"
    fi
  fi
}

# ── Install via git ────────────────────────────────────────────────────
install_git() {
  if ! command_exists git; then
    err "git is not installed."
    echo ""
    echo "  Install git:  sudo apt install git   (Debian/Ubuntu)"
    echo "                sudo dnf install git    (Fedora)"
    echo "                brew install git        (macOS)"
    echo ""
    exit 1
  fi

  local target="$HOME/opsagent"

  if [[ -d "$target/.git" ]]; then
    info "Updating existing checkout at $target..."
    git -C "$target" pull --rebase
  else
    info "Cloning OpsAgent to $target..."
    git clone --depth 1 "$REPO" "$target"
  fi

  cd "$target"

  # Enable corepack for pnpm
  if ! command_exists pnpm; then
    info "Enabling pnpm via corepack..."
    if [[ "$(id -u)" -eq 0 ]]; then
      corepack enable
    else
      sudo corepack enable
    fi
  fi

  info "Installing dependencies..."
  pnpm install

  info "Building..."
  pnpm build

  # Symlink the binary
  local bin_target="/usr/local/bin"
  local link_path="$bin_target/opsagent"

  info "Linking opsagent → $link_path..."
  if [[ "$(id -u)" -eq 0 ]]; then
    ln -sf "$target/dist/entry.js" "$link_path"
    chmod +x "$target/dist/entry.js"
  else
    sudo ln -sf "$target/dist/entry.js" "$link_path"
    sudo chmod +x "$target/dist/entry.js"
  fi
}

# ── Post-install ───────────────────────────────────────────────────────
post_install() {
  mkdir -p "$CONFIG_DIR"

  echo ""
  ok "OpsAgent installed successfully!"
  echo ""

  local installed_version
  if command_exists opsagent; then
    installed_version="$(opsagent --version 2>/dev/null || echo "unknown")"
    echo "  Version:  $installed_version"
  fi
  echo "  Config:   $CONFIG_DIR"
  echo ""

  printf "${BOLD}Quick start:${RESET}\n"
  echo ""
  echo "  opsagent onboard --install-daemon   # First-time setup"
  echo "  opsagent gateway --port 18789       # Start the gateway"
  echo "  opsagent agent --message \"Hello\"     # Talk to the agent"
  echo "  opsagent status                     # Check health"
  echo ""
  printf "  Docs: ${CYAN}https://docs.opsagent.dev${RESET}\n"
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────
main() {
  if [[ "$UNINSTALL" == true ]]; then
    do_uninstall
  fi

  banner
  info "Detecting environment..."
  check_node
  check_npm

  case "$METHOD" in
    npm) install_npm ;;
    git) install_git ;;
    *)   err "Unknown install method: $METHOD"; exit 1 ;;
  esac

  post_install
}

main
