#!/usr/bin/env bash
set -euo pipefail

cd /repo

export JARVIS_STATE_DIR="/tmp/jarvis-test"
export JARVIS_CONFIG_PATH="${JARVIS_STATE_DIR}/jarvis.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${JARVIS_STATE_DIR}/credentials"
mkdir -p "${JARVIS_STATE_DIR}/agents/main/sessions"
echo '{}' >"${JARVIS_CONFIG_PATH}"
echo 'creds' >"${JARVIS_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${JARVIS_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm jarvis reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${JARVIS_CONFIG_PATH}"
test ! -d "${JARVIS_STATE_DIR}/credentials"
test ! -d "${JARVIS_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${JARVIS_STATE_DIR}/credentials"
echo '{}' >"${JARVIS_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm jarvis uninstall --state --yes --non-interactive

test ! -d "${JARVIS_STATE_DIR}"

echo "OK"
