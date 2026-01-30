## OpsAgent Production Readiness Test Script (Windows)
## Validates all hardening changes before deployment.

$ErrorActionPreference = "Continue"
$pass = 0
$fail = 0

function Pass($msg) { $script:pass++; Write-Host "PASS" -ForegroundColor Green -NoNewline; Write-Host " $msg" }
function Fail($msg) { $script:fail++; Write-Host "FAIL" -ForegroundColor Red -NoNewline; Write-Host " $msg" }
function Info($msg) { Write-Host "---- $msg" -ForegroundColor Yellow }

Set-Location "$PSScriptRoot\.."

## 1. Unit tests for new modules
Info "Running rate-limit tests..."
npx vitest run src/gateway/rate-limit.test.ts --reporter=verbose 2>&1
if ($LASTEXITCODE -eq 0) { Pass "Rate limiter tests" } else { Fail "Rate limiter tests" }

Info "Running startup-preflight tests..."
npx vitest run src/gateway/startup-preflight.test.ts --reporter=verbose 2>&1
if ($LASTEXITCODE -eq 0) { Pass "Startup preflight tests" } else { Fail "Startup preflight tests" }

Info "Running server-close tests..."
npx vitest run src/gateway/server-close.test.ts --reporter=verbose 2>&1
if ($LASTEXITCODE -eq 0) { Pass "Gateway close handler tests" } else { Fail "Gateway close handler tests" }

Info "Running otel tests..."
npx vitest run src/infra/otel.test.ts --reporter=verbose 2>&1
if ($LASTEXITCODE -eq 0) { Pass "OpenTelemetry tests" } else { Fail "OpenTelemetry tests" }

## 2. Full test suite
Info "Running full test suite..."
npx vitest run --reporter=verbose 2>&1
if ($LASTEXITCODE -eq 0) { Pass "Full test suite" } else { Fail "Full test suite" }

## 3. Lint
Info "Running linter..."
npx pnpm lint 2>&1
if ($LASTEXITCODE -eq 0) { Pass "Lint" } else { Fail "Lint" }

## 4. Build
Info "Running build..."
npx pnpm build 2>&1
if ($LASTEXITCODE -eq 0) { Pass "Build" } else { Fail "Build" }

## 5. Static checks
Info "Checking CI config has E2E job..."
if (Select-String -Path ".github\workflows\ci.yml" -Pattern "task: e2e" -Quiet) {
    Pass "CI has E2E test job"
} else { Fail "CI missing E2E test job" }

Info "Checking Docker Compose hardening..."
$dc = Get-Content docker-compose.yml -Raw
if ($dc -match "read_only: true" -and $dc -match "cap_drop" -and $dc -match "no-new-privileges") {
    Pass "Docker Compose hardened"
} else { Fail "Docker Compose missing hardening flags" }

Info "Checking CHANGELOG release status..."
if (Select-String -Path "CHANGELOG.md" -Pattern "Released: 2026-01-30" -Quiet) {
    Pass "CHANGELOG version finalized"
} else { Fail "CHANGELOG still unreleased" }

Info "Checking rate limit schema..."
if (Select-String -Path "src\config\zod-schema.ts" -Pattern "rateLimit" -Quiet) {
    Pass "Rate limit config schema present"
} else { Fail "Rate limit config schema missing" }

Info "Checking preflight wired into server.impl..."
if (Select-String -Path "src\gateway\server.impl.ts" -Pattern "runStartupPreflight" -Quiet) {
    Pass "Preflight wired into gateway startup"
} else { Fail "Preflight not wired" }

Info "Checking OTEL wired into server.impl..."
$si = Get-Content "src\gateway\server.impl.ts" -Raw
if ($si -match "initOtel" -and $si -match "otelHandle.shutdown") {
    Pass "OTEL wired into startup + shutdown"
} else { Fail "OTEL not properly wired" }

Info "Checking rate limiter wired into HTTP handler..."
if (Select-String -Path "src\gateway\server-http.ts" -Pattern "rateLimiter.allow" -Quiet) {
    Pass "Rate limiter wired into HTTP handler"
} else { Fail "Rate limiter not wired" }

## Summary
Write-Host ""
Write-Host "==========================================="
Write-Host "  PASSED: $pass    FAILED: $fail"
Write-Host "==========================================="

if ($fail -gt 0) { exit 1 }
