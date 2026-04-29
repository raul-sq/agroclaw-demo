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

# Persistent OpenClaw home (mounted by Coolify)
ENV OPENCLAW_HOME=/home/node/.openclaw
RUN mkdir -p /home/node/.openclaw && chown -R node:node /home/node

USER node

EXPOSE 3000

# Liveness: Express is the contract. start-period generous but not enormous,
# because Express now boots in ~1-2s independent of OpenClaw warm-up.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/scripts/start.sh"]
