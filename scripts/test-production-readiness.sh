#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# OpsAgent Production Readiness Test Script
# Validates all hardening changes before deployment.
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS=0
FAIL=0

pass() { ((PASS++)); echo -e "${GREEN}PASS${NC} $1"; }
fail() { ((FAIL++)); echo -e "${RED}FAIL${NC} $1"; }
info() { echo -e "${YELLOW}----${NC} $1"; }

cd "$(dirname "$0")/.."

# ─────────────────────────────────────────────────────────────
# 1. Unit tests for new modules
# ─────────────────────────────────────────────────────────────
info "Running rate-limit tests..."
if npx vitest run src/gateway/rate-limit.test.ts --reporter=verbose 2>&1; then
  pass "Rate limiter tests"
else
  fail "Rate limiter tests"
fi

info "Running startup-preflight tests..."
if npx vitest run src/gateway/startup-preflight.test.ts --reporter=verbose 2>&1; then
  pass "Startup preflight tests"
else
  fail "Startup preflight tests"
fi

info "Running server-close tests..."
if npx vitest run src/gateway/server-close.test.ts --reporter=verbose 2>&1; then
  pass "Gateway close handler tests"
else
  fail "Gateway close handler tests"
fi

info "Running otel tests..."
if npx vitest run src/infra/otel.test.ts --reporter=verbose 2>&1; then
  pass "OpenTelemetry tests"
else
  fail "OpenTelemetry tests"
fi

# ─────────────────────────────────────────────────────────────
# 2. Full test suite (existing + new)
# ─────────────────────────────────────────────────────────────
info "Running full test suite..."
if npx vitest run --reporter=verbose 2>&1; then
  pass "Full test suite"
else
  fail "Full test suite"
fi

# ─────────────────────────────────────────────────────────────
# 3. Lint check
# ─────────────────────────────────────────────────────────────
info "Running linter..."
if pnpm lint 2>&1; then
  pass "Lint"
else
  fail "Lint"
fi

# ─────────────────────────────────────────────────────────────
# 4. Build check
# ─────────────────────────────────────────────────────────────
info "Running build..."
if pnpm build 2>&1; then
  pass "Build"
else
  fail "Build"
fi

# ─────────────────────────────────────────────────────────────
# 5. Static checks on modified files
# ─────────────────────────────────────────────────────────────
info "Checking CI config has E2E job..."
if grep -q 'task: e2e' .github/workflows/ci.yml; then
  pass "CI has E2E test job"
else
  fail "CI missing E2E test job"
fi

info "Checking Docker Compose hardening..."
if grep -q 'read_only: true' docker-compose.yml && \
   grep -q 'cap_drop' docker-compose.yml && \
   grep -q 'no-new-privileges' docker-compose.yml; then
  pass "Docker Compose hardened"
else
  fail "Docker Compose missing hardening flags"
fi

info "Checking CHANGELOG release status..."
if grep -q 'Released: 2026-01-30' CHANGELOG.md; then
  pass "CHANGELOG version finalized"
else
  fail "CHANGELOG still unreleased"
fi

info "Checking rate limit schema in zod-schema..."
if grep -q 'rateLimit' src/config/zod-schema.ts; then
  pass "Rate limit config schema present"
else
  fail "Rate limit config schema missing"
fi

info "Checking preflight wired into server.impl..."
if grep -q 'runStartupPreflight' src/gateway/server.impl.ts; then
  pass "Preflight wired into gateway startup"
else
  fail "Preflight not wired"
fi

info "Checking OTEL wired into server.impl..."
if grep -q 'initOtel' src/gateway/server.impl.ts && \
   grep -q 'otelHandle.shutdown' src/gateway/server.impl.ts; then
  pass "OTEL wired into startup + shutdown"
else
  fail "OTEL not properly wired"
fi

info "Checking rate limiter wired into HTTP handler..."
if grep -q 'rateLimiter.allow' src/gateway/server-http.ts; then
  pass "Rate limiter wired into HTTP handler"
else
  fail "Rate limiter not wired"
fi

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo ""
echo "==========================================="
echo -e "  ${GREEN}PASSED: $PASS${NC}    ${RED}FAILED: $FAIL${NC}"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
