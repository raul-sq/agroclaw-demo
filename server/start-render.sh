#!/usr/bin/env bash

set -u

export PATH="./node_modules/.bin:$PATH"

echo "Starting OpenClaw gateway in background..."
(openclaw gateway --force || echo "OpenClaw gateway could not be started at boot.") &

sleep 5

echo "Starting AgroClaw demo bridge..."
node server/server.js
