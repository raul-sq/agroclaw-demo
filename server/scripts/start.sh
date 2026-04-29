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
GATEWAY_LISTEN_TIMEOUT_S="${OPENCLAW_GATEWAY_LISTEN_TIMEOUT_S:-180}"
GATEWAY_READY_TIMEOUT_S="${OPENCLAW_GATEWAY_READY_TIMEOUT_S:-300}"

WARMUP_ENABLED="${AGROCLAW_WARMUP_ENABLED:-true}"
WARMUP_PROMPT="${AGROCLAW_WARMUP_PROMPT:-Responde unicamente: AgroClaw listo.}"
WARMUP_TIMEOUT_S="${AGROCLAW_WARMUP_TIMEOUT_SECONDS:-60}"
WARMUP_MAX_RETRIES="${AGROCLAW_WARMUP_MAX_RETRIES:-3}"
OPENCLAW_MODEL="${OPENCLAW_MODEL:-openai-codex/gpt-5.5}"

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
: > "${GATEWAY_LOG}"
: > "${WARMUP_LOG}"

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
log "OpenClaw model:     ${OPENCLAW_MODEL}"

if [[ ! -f "${OPENCLAW_CONFIG}" ]]; then
  log "FATAL: missing OpenClaw config at ${OPENCLAW_CONFIG}"
  log "Run the container once with AGROCLAW_BOOTSTRAP_MODE=true and complete onboarding inside it."
  exit 1
fi

mkdir -p "${OPENCLAW_WORKSPACE}"

# ---------- gateway lifecycle ----------
start_gateway() {
  log "launching OpenClaw Gateway on port ${GATEWAY_PORT}"
  openclaw gateway run >>"${GATEWAY_LOG}" 2>&1 &
  local gw_pid=$!
  echo "${gw_pid}" > "${STATE_DIR}/gateway.pid"
  log "gateway pid=${gw_pid}, log=${GATEWAY_LOG}"
}

wait_for_gateway_listen() {
  local deadline=$(( $(date +%s) + GATEWAY_LISTEN_TIMEOUT_S ))
  local attempt=0
  while (( $(date +%s) < deadline )); do
    attempt=$(( attempt + 1 ))
    if curl -sf -o /dev/null --max-time 3 "${GATEWAY_HEALTH_URL}"; then
      log "gateway HTTP listening after ${attempt} probes"
      return 0
    fi
    sleep 2
  done
  log "gateway HTTP did NOT start in ${GATEWAY_LISTEN_TIMEOUT_S}s"
  return 1
}

wait_for_gateway_ready() {
  local deadline=$(( $(date +%s) + GATEWAY_READY_TIMEOUT_S ))
  while (( $(date +%s) < deadline )); do
    if grep -q '\[gateway\] ready' "${GATEWAY_LOG}" 2>/dev/null; then
      log "gateway fully ready (detected '[gateway] ready' in log)"
      return 0
    fi
    sleep 3
  done
  log "gateway did NOT emit '[gateway] ready' in ${GATEWAY_READY_TIMEOUT_S}s"
  return 1
}

# ---------- warm-up via 'infer model run' (fast: ~10-15s) ----------
run_warmup_once() {
  timeout "${WARMUP_TIMEOUT_S}" \
    openclaw infer model run \
      --gateway \
      --model "${OPENCLAW_MODEL}" \
      --prompt "${WARMUP_PROMPT}" \
      >>"${WARMUP_LOG}" 2>&1
}

run_warmup() {
  if [[ "${WARMUP_ENABLED}" != "true" ]]; then
    log "warmup disabled"
    echo "skipped" > "${STATE_WARMUP}"
    echo "true"    > "${STATE_READY}"
    return 0
  fi

  log "running warm-up via 'infer model run' (timeout=${WARMUP_TIMEOUT_S}s, retries=${WARMUP_MAX_RETRIES})"
  echo "running" > "${STATE_WARMUP}"

  local i
  for (( i=1; i<=WARMUP_MAX_RETRIES; i++ )); do
    log "warm-up attempt ${i}/${WARMUP_MAX_RETRIES}"
    echo "----- attempt ${i} at $(date -u +%H:%M:%S) -----" >> "${WARMUP_LOG}"
    if run_warmup_once; then
      log "warm-up OK on attempt ${i}"
      echo "ok"   > "${STATE_WARMUP}"
      echo "true" > "${STATE_READY}"
      return 0
    fi
    log "warm-up attempt ${i} failed; sleeping 10s before retry"
    sleep 10
  done

  log "warm-up FAILED after ${WARMUP_MAX_RETRIES} attempts (see ${WARMUP_LOG}) — service stays alive"
  echo "failed" > "${STATE_WARMUP}"
}

orchestrate() {
  start_gateway

  if ! wait_for_gateway_listen; then
    echo "failed" > "${STATE_GATEWAY}"
    echo "skipped" > "${STATE_WARMUP}"
    log "abort: gateway HTTP never came up"
    return
  fi
  echo "listening" > "${STATE_GATEWAY}"

  if ! wait_for_gateway_ready; then
    log "proceeding to warm-up despite missing 'ready' log marker"
    echo "ready_unknown" > "${STATE_GATEWAY}"
  else
    echo "ready" > "${STATE_GATEWAY}"
  fi

  run_warmup
}

# Run orchestration in background. Express must not wait for it.
orchestrate &

# ---------- foreground: express ----------
log "starting Express bridge on :3000 (immediate)"
cd /app
exec node /app/server.js
