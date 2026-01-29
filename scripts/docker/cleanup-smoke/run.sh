#!/usr/bin/env bash
set -euo pipefail

cd /repo

export OPSAGENT_STATE_DIR="/tmp/opsagent-test"
export OPSAGENT_CONFIG_PATH="${OPSAGENT_STATE_DIR}/opsagent.json"

echo "==> Seed state"
mkdir -p "${OPSAGENT_STATE_DIR}/credentials"
mkdir -p "${OPSAGENT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${OPSAGENT_CONFIG_PATH}"
echo 'creds' >"${OPSAGENT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${OPSAGENT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm opsagent reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${OPSAGENT_CONFIG_PATH}"
test ! -d "${OPSAGENT_STATE_DIR}/credentials"
test ! -d "${OPSAGENT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${OPSAGENT_STATE_DIR}/credentials"
echo '{}' >"${OPSAGENT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm opsagent uninstall --state --yes --non-interactive

test ! -d "${OPSAGENT_STATE_DIR}"

echo "OK"
