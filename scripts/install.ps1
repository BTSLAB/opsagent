# OpsAgent Installer for Windows
# Usage: irm https://raw.githubusercontent.com/BTSLAB/opsagent/main/scripts/install.ps1 | iex
#   or:  iex "& { $(irm https://raw.githubusercontent.com/BTSLAB/opsagent/main/scripts/install.ps1) } -Version 2026.1.25"
#
# Parameters:
#   -Beta          Install beta channel
#   -Version       Install a specific version
#   -Uninstall     Remove OpsAgent
#   -Verbose       Show detailed output

param(
    [switch]$Beta,
    [string]$Version,
    [switch]$Uninstall,
    [switch]$ShowVerbose
)

$ErrorActionPreference = "Stop"

$Package = "opsagent"
$MinNodeMajor = 22
$ConfigDir = if ($env:OPSAGENT_CONFIG_DIR) { $env:OPSAGENT_CONFIG_DIR } else { "$env:USERPROFILE\.opsagent" }

function Write-Banner {
    Write-Host ""
    Write-Host "   ___              _                    _" -ForegroundColor Cyan
    Write-Host "  / _ \ _ __  ___  / \   __ _  ___ _ __ | |_" -ForegroundColor Cyan
    Write-Host " | | | | '_ \/ __|| _ \ / _`" -NoNewline -ForegroundColor Cyan
    Write-Host " |/ _ \ '_ \| __|" -ForegroundColor Cyan
    Write-Host " | |_| | |_) \__ \| |_| | (_| |  __/ | | | |_" -ForegroundColor Cyan
    Write-Host "  \___/| .__/|___/|_| |_|\__, |\___|_| |_|\__|" -ForegroundColor Cyan
    Write-Host "       |_|               |___/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  OpsAgent " -ForegroundColor White -NoNewline
    Write-Host "- AI Operations Assistant by BTS Labs" -ForegroundColor Gray
    Write-Host ""
}

function Write-Info($msg) { Write-Host "  > $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  > $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  x $msg" -ForegroundColor Red }
function Write-Ok($msg)   { Write-Host "  + $msg" -ForegroundColor Green }

function Test-Command($name) {
    $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Test-Node {
    if (-not (Test-Command "node")) {
        Write-Err "Node.js is not installed."
        Write-Host ""
        Write-Host "  Install Node >= $MinNodeMajor from https://nodejs.org"
        Write-Host ""
        exit 1
    }

    $nodeVersion = (node -v) -replace '^v', ''
    $major = [int]($nodeVersion.Split('.')[0])

    if ($major -lt $MinNodeMajor) {
        Write-Err "Node.js $nodeVersion found - OpsAgent requires Node >= $MinNodeMajor."
        exit 1
    }

    if ($ShowVerbose) { Write-Host "  [debug] Node.js $nodeVersion OK" -ForegroundColor DarkCyan }
}

function Test-Npm {
    if (-not (Test-Command "npm")) {
        Write-Err "npm is not installed. Install Node.js from https://nodejs.org"
        exit 1
    }

    if ($ShowVerbose) {
        $npmVer = npm -v
        Write-Host "  [debug] npm $npmVer OK" -ForegroundColor DarkCyan
    }
}

# ── Uninstall ──────────────────────────────────────────────────────────
function Invoke-Uninstall {
    Write-Banner
    Write-Info "Uninstalling OpsAgent..."

    # Stop gateway
    Get-Process -Name "*opsagent*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    # npm uninstall
    try {
        $listed = npm ls -g $Package 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Removing npm global package..."
            npm uninstall -g $Package
        }
    } catch {}

    Write-Ok "OpsAgent uninstalled."
    Write-Host ""
    Write-Warn "Config directory preserved at $ConfigDir"
    Write-Host "  Remove manually: Remove-Item -Recurse -Force '$ConfigDir'"
    Write-Host ""
    exit 0
}

# ── Install ────────────────────────────────────────────────────────────
function Invoke-Install {
    $pkgSpec = $Package

    if ($Version) {
        $pkgSpec = "${Package}@${Version}"
    } elseif ($Beta) {
        $pkgSpec = "${Package}@beta"
    } else {
        $pkgSpec = "${Package}@latest"
    }

    Write-Info "Installing $pkgSpec via npm..."

    npm install -g $pkgSpec
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed (exit code $LASTEXITCODE)"
        exit 1
    }
}

# ── Post-install ───────────────────────────────────────────────────────
function Invoke-PostInstall {
    if (-not (Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }

    Write-Host ""
    Write-Ok "OpsAgent installed successfully!"
    Write-Host ""

    if (Test-Command "opsagent") {
        try {
            $ver = opsagent --version 2>&1
            Write-Host "  Version:  $ver"
        } catch {}
    }

    Write-Host "  Config:   $ConfigDir"
    Write-Host ""
    Write-Host "  Quick start:" -ForegroundColor White
    Write-Host ""
    Write-Host "    opsagent onboard --install-daemon   # First-time setup"
    Write-Host "    opsagent gateway --port 18789       # Start the gateway"
    Write-Host "    opsagent agent --message `"Hello`"    # Talk to the agent"
    Write-Host "    opsagent status                     # Check health"
    Write-Host ""
    Write-Host "  Docs: https://docs.opsagent.dev" -ForegroundColor Cyan
    Write-Host ""
}

# ── Main ───────────────────────────────────────────────────────────────
if ($Uninstall) {
    Invoke-Uninstall
}

Write-Banner
Write-Info "Detecting environment..."
Test-Node
Test-Npm

Invoke-Install
Invoke-PostInstall
