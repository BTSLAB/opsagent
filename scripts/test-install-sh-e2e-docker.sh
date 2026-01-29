#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${OPSAGENT_INSTALL_E2E_IMAGE:-opsagent-install-e2e:local}"
INSTALL_URL="${OPSAGENT_INSTALL_URL:-https://opsagent.dev/install.sh}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_API_TOKEN="${ANTHROPIC_API_TOKEN:-}"
OPSAGENT_E2E_MODELS="${OPSAGENT_E2E_MODELS:-}"

echo "==> Build image: $IMAGE_NAME"
docker build \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/scripts/docker/install-sh-e2e/Dockerfile" \
  "$ROOT_DIR/scripts/docker/install-sh-e2e"

echo "==> Run E2E installer test"
docker run --rm \
  -e OPSAGENT_INSTALL_URL="$INSTALL_URL" \
  -e OPSAGENT_INSTALL_TAG="${OPSAGENT_INSTALL_TAG:-latest}" \
  -e OPSAGENT_E2E_MODELS="$OPSAGENT_E2E_MODELS" \
  -e OPSAGENT_INSTALL_E2E_PREVIOUS="${OPSAGENT_INSTALL_E2E_PREVIOUS:-}" \
  -e OPSAGENT_INSTALL_E2E_SKIP_PREVIOUS="${OPSAGENT_INSTALL_E2E_SKIP_PREVIOUS:-0}" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ANTHROPIC_API_TOKEN="$ANTHROPIC_API_TOKEN" \
  "$IMAGE_NAME"
