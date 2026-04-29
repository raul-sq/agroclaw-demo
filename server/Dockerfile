FROM node:24-bookworm-slim

ARG OPENCLAW_VERSION=2026.4.26

ENV NODE_ENV=production
ENV HOME=/home/node
ENV PORT=3000
ENV HOST=0.0.0.0
ENV OPENCLAW_HOME=/home/node/.openclaw
ENV OPENCLAW_STATE_DIR=/home/node/.openclaw
ENV OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json
ENV OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw/workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    lsof \
    procps \
    psmisc \
    tini \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g "openclaw@${OPENCLAW_VERSION}"

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ /app/

RUN chmod +x /app/scripts/*.sh \
  && mkdir -p /home/node/.openclaw \
  && chown -R node:node /home/node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD if [ "$AGROCLAW_BOOTSTRAP_MODE" = "true" ]; then exit 0; fi; curl -fsS http://127.0.0.1:3000/health >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/scripts/start.sh"]
