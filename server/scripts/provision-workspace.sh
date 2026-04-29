#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-/home/node/.openclaw/workspace}"
TEMPLATE_DIR="${AGROCLAW_WORKSPACE_TEMPLATE:-/app/workspace-template}"

mkdir -p "$WORKSPACE_DIR"

if [ -d "$TEMPLATE_DIR" ] && [ -z "$(find "$WORKSPACE_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
  echo "[agroclaw] Provisioning workspace from template..."
  cp -a "$TEMPLATE_DIR"/. "$WORKSPACE_DIR"/
else
  echo "[agroclaw] Workspace already exists or template missing. Skipping provisioning."
fi
