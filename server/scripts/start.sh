#!/usr/bin/env bash
set -euo pipefail

export HOME="${HOME:-/home/node}"
export OPENCLAW_HOME="${OPENCLAW_HOME:-/home/node/.openclaw}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
export OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-/home/node/.openclaw/openclaw.json}"
export OPENCLAW_WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-/home/node/.openclaw/workspace}"

mkdir -p "$OPENCLAW_HOME" "$OPENCLAW_STATE_DIR" "$OPENCLAW_WORKSPACE_DIR"

echo "[agroclaw] OpenClaw home: $OPENCLAW_HOME"
echo "[agroclaw] OpenClaw config: $OPENCLAW_CONFIG_PATH"
echo "[agroclaw] OpenClaw workspace: $OPENCLAW_WORKSPACE_DIR"

bash /app/scripts/provision-workspace.sh

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[agroclaw] ERROR: openclaw command not found."
  exit 1
fi

if [ ! -f "$OPENCLAW_CONFIG_PATH" ]; then
  echo "[agroclaw] OpenClaw config not found at $OPENCLAW_CONFIG_PATH"

  if [ "${AGROCLAW_BOOTSTRAP_MODE:-false}" = "true" ]; then
    echo "[agroclaw] Bootstrap mode enabled."
    echo "[agroclaw] Keeping container alive so you can open a terminal and run OpenClaw onboarding."
    echo "[agroclaw] After onboarding, set AGROCLAW_BOOTSTRAP_MODE=false and redeploy."
    tail -f /dev/null
  fi

  echo "[agroclaw] ERROR: OpenClaw must be provisioned before production start."
  exit 1
fi

echo "[agroclaw] Starting OpenClaw Gateway..."
openclaw gateway --force > /tmp/openclaw-gateway.log 2>&1 &
GATEWAY_PID=$!

echo "[agroclaw] Waiting for Gateway readiness..."
for i in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:18789/healthz" >/dev/null 2>&1; then
    echo "[agroclaw] Gateway healthz OK."
    break
  fi

  if ! kill -0 "$GATEWAY_PID" >/dev/null 2>&1; then
    echo "[agroclaw] Gateway process exited during startup."
    cat /tmp/openclaw-gateway.log || true
    exit 1
  fi

  sleep 2
done

if ! curl -fsS "http://127.0.0.1:18789/healthz" >/dev/null 2>&1; then
  echo "[agroclaw] Gateway did not become healthy."
  cat /tmp/openclaw-gateway.log || true
  exit 1
fi

if [ "${AGROCLAW_WARMUP_ENABLED:-true}" = "true" ]; then
  echo "[agroclaw] Running warm-up prompt..."
  WARMUP_PROMPT="${AGROCLAW_WARMUP_PROMPT:-Responde únicamente: AgroClaw listo. No uses herramientas externas.}"
  timeout "${AGROCLAW_WARMUP_TIMEOUT_SECONDS:-300}"     openclaw agent --agent "${OPENCLAW_AGENT_ID:-main}" --message "$WARMUP_PROMPT"     > /tmp/agroclaw-warmup.log 2>&1 || {
      echo "[agroclaw] Warm-up failed. Logs:"
      cat /tmp/agroclaw-warmup.log || true
      exit 1
    }
  echo "[agroclaw] Warm-up completed."
fi

echo "[agroclaw] Starting Express bridge..."
node /app/server.js &
BRIDGE_PID=$!
trap 'echo "[agroclaw] Stopping..."; kill "$BRIDGE_PID" "$GATEWAY_PID" 2>/dev/null || true' SIGTERM SIGINT
wait -n "$BRIDGE_PID" "$GATEWAY_PID"
EXIT_CODE=$?
echo "[agroclaw] One process exited. Gateway logs follow."
cat /tmp/openclaw-gateway.log || true
exit "$EXIT_CODE"
