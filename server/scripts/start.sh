#!/usr/bin/env bash
# AgroClaw container entrypoint
# Strategy: start Express IMMEDIATELY so Coolify healthcheck passes.
# Gateway + warm-up run in background and update state flags consumed by server.js.

set -u
set -o pipefail

# ---------- config ----------
# Do NOT export OPENCLAW_HOME: openclaw appends ".openclaw" itself when that var is set,
# producing /home/node/.openclaw/.openclaw/openclaw.json. We rely on HOME instead.
OPENCLAW_DIR="${HOME}/.openclaw"
OPENCLAW_CONFIG="${OPENCLAW_DIR}/openclaw.json"
OPENCLAW_WORKSPACE="${OPENCLAW_DIR}/workspace"

GATEWAY_HEALTH_URL="${OPENCLAW_GATEWAY_HEALTH_URL:-http://127.0.0.1:18789/healthz}"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
GATEWAY_BOOT_TIMEOUT_S="${OPENCLAW_GATEWAY_BOOT_TIMEOUT_S:-180}"

WARMUP_ENABLED="${AGROCLAW_WARMUP_ENABLED:-true}"
WARMUP_PROMPT="${AGROCLAW_WARMUP_PROMPT:-Responde unicamente: AgroClaw listo. No uses herramientas externas.}"
WARMUP_TIMEOUT_S="${AGROCLAW_WARMUP_TIMEOUT_SECONDS:-300}"
AGENT_ID="${OPENCLAW_AGENT_ID:-main}"

BOOTSTRAP_MODE="${AGROCLAW_BOOTSTRAP_MODE:-false}"

STATE_DIR="/tmp/agroclaw-state"
STATE_GATEWAY="${STATE_DIR}/gateway.flag"
STATE_WARMUP="${STATE_DIR}/warmup.flag"
STATE_READY="${STATE_DIR}/ready.flag"
GATEWAY_LOG="${STATE_DIR}/gateway.log"
WARMUP_LOG="${STATE_DIR}/warmup.log"

mkdir -p "${STATE_DIR}"
echo "starting" > "${STATE_GATEWAY}"
echo "pending"  > "${STATE_WARMUP}"
echo "false"    > "${STATE_READY}"

log() {
  echo "[agroclaw $(date -u +%H:%M:%S)] $*"
}

# ---------- bootstrap mode short-circuit ----------
if [[ "${BOOTSTRAP_MODE}" == "true" ]]; then
  log "BOOTSTRAP_MODE=true -> sleeping forever (use this container as a shell to run onboarding)"
  exec tail -f /dev/null
fi

# ---------- workspace sanity ----------
log "OpenClaw dir:       ${OPENCLAW_DIR}"
log "OpenClaw config:    ${OPENCLAW_CONFIG}"
log "OpenClaw workspace: ${OPENCLAW_WORKSPACE}"

if [[ ! -f "${OPENCLAW_CONFIG}" ]]; then
  log "FATAL: missing OpenClaw config at ${OPENCLAW_CONFIG}"
  log "Run the container once with AGROCLAW_BOOTSTRAP_MODE=true and complete onboarding inside it."
  exit 1
fi

mkdir -p "${OPENCLAW_WORKSPACE}"

# ---------- background: gateway ----------
start_gateway() {
  log "launching OpenClaw Gateway on port ${GATEWAY_PORT}"
  # 'run' (not '--force'): we are in a fresh container, no listeners to kill.
  # Output goes to a log file we keep, so we can inspect it via /status.
  openclaw gateway run >>"${GATEWAY_LOG}" 2>&1 &
  local gw_pid=$!
  echo "${gw_pid}" > "${STATE_DIR}/gateway.pid"
  log "gateway pid=${gw_pid}, log=${GATEWAY_LOG}"
}

wait_for_gateway() {
  local deadline=$(( $(date +%s) + GATEWAY_BOOT_TIMEOUT_S ))
  local attempt=0
  while (( $(date +%s) < deadline )); do
    attempt=$(( attempt + 1 ))
    if curl -sf -o /dev/null --max-time 3 "${GATEWAY_HEALTH_URL}"; then
      log "gateway healthy after ${attempt} probes"
      echo "ready" > "${STATE_GATEWAY}"
      return 0
    fi
    sleep 2
  done
  log "gateway did NOT become healthy in ${GATEWAY_BOOT_TIMEOUT_S}s"
  echo "failed" > "${STATE_GATEWAY}"
  return 1
}

run_warmup() {
  if [[ "${WARMUP_ENABLED}" != "true" ]]; then
    log "warmup disabled"
    echo "skipped" > "${STATE_WARMUP}"
    echo "true"    > "${STATE_READY}"
    return 0
  fi

  log "running warm-up (timeout ${WARMUP_TIMEOUT_S}s)"
  echo "running" > "${STATE_WARMUP}"

  # timeout returns 124 on timeout. We capture stdout/stderr to log.
  if timeout "${WARMUP_TIMEOUT_S}" \
      openclaw agent --agent "${AGENT_ID}" --message "${WARMUP_PROMPT}" \
      >>"${WARMUP_LOG}" 2>&1; then
    log "warm-up OK"
    echo "ok"   > "${STATE_WARMUP}"
    echo "true" > "${STATE_READY}"
  else
    local rc=$?
    log "warm-up FAILED rc=${rc} (see ${WARMUP_LOG}) — service stays alive, will retry on first user request"
    echo "failed" > "${STATE_WARMUP}"
    # ready stays false; chat endpoint will return 503 until a successful agent call
  fi
}

orchestrate() {
  start_gateway
  if wait_for_gateway; then
    run_warmup
  else
    log "skipping warm-up because gateway never became healthy"
    echo "skipped" > "${STATE_WARMUP}"
  fi
}

# Run orchestration in background. Express must not wait for it.
orchestrate &

# ---------- foreground: express ----------
log "starting Express bridge on :3000 (immediate)"
cd /app
exec node /app/server.js
