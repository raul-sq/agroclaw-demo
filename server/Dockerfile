FROM node:24-bookworm-slim

# System deps:
#  - bash, ca-certificates, curl, git: básicos
#  - lsof, procps, psmisc: para que 'openclaw gateway' tenga utilidades disponibles si las necesita
#  - tini: PID 1 correcto, reaping de zombies
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    lsof \
    procps \
    psmisc \
    tini \
 && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally (pin version to match onboarding)
RUN npm install -g openclaw@2026.4.26

# App
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server.js ./server.js
COPY scripts/ ./scripts/
RUN chmod +x /app/scripts/start.sh

# IMPORTANT: Do NOT set OPENCLAW_HOME.
# OpenClaw resolves config as $OPENCLAW_HOME/.openclaw/openclaw.json when set
# (i.e. it appends ".openclaw" itself). Setting OPENCLAW_HOME=/home/node/.openclaw
# made it look in /home/node/.openclaw/.openclaw/openclaw.json -> "Missing config".
# With HOME=/home/node and OPENCLAW_HOME unset, OpenClaw uses $HOME/.openclaw which
# is exactly where the persistent volume is mounted.
RUN mkdir -p /home/node/.openclaw && chown -R node:node /home/node

USER node

EXPOSE 3000

# Liveness: Express is the contract. start-period generous but not enormous,
# because Express now boots in ~1-2s independent of OpenClaw warm-up.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD if [ "$AGROCLAW_BOOTSTRAP_MODE" = "true" ]; then exit 0; fi; curl -fsS http://127.0.0.1:3000/health >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/scripts/start.sh"]
