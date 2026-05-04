// AgroClaw Express bridge (ESM)
// - GET  /health   → 200 always while Express is alive (Coolify liveness)
// - GET  /status   → real status (gateway + warmup + ready)
// - POST /api/agroclaw/chat → 503 until ready, then proxies to OpenClaw
//
// Inference path: `openclaw agent --agent main --json --message ...`
// This is intentionally the real AgroClaw agent path, not plain model inference.
// The agent can use the workspace, skills and knowledge base.

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

// ---------- config ----------
const PORT = parseInt(process.env.PORT || '3000', 10);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://agroclaw-demo.netlify.app,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const OPENCLAW_MODEL = process.env.OPENCLAW_MODEL || 'openai-codex/gpt-5.5';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const OPENCLAW_TIMEOUT_MS = parseInt(process.env.OPENCLAW_TIMEOUT_MS || '300000', 10);
const MAX_PROMPT_CHARS = parseInt(process.env.MAX_PROMPT_CHARS || '4000', 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1', 10);

const WORKSPACE_DIR = path.join(os.homedir(), '.openclaw', 'workspace');
// Order matters: identity/soul first, then operational/tools, then user.
const WORKSPACE_FILES = [
  'IDENTITY.md',
  'SOUL.md',
  'AGENTS.md',
  'TOOLS.md',
  'USER.md',
  'BOOTSTRAP.md',
  'HEARTBEAT.md',
];

const STATE_DIR = '/tmp/agroclaw-state';
const STATE_GATEWAY = path.join(STATE_DIR, 'gateway.flag');
const STATE_WARMUP  = path.join(STATE_DIR, 'warmup.flag');
const STATE_READY   = path.join(STATE_DIR, 'ready.flag');

// ---------- helpers ----------
function readFlag(p, fallback = 'unknown') {
  try { return fs.readFileSync(p, 'utf8').trim() || fallback; }
  catch { return fallback; }
}

function getStatus() {
  return {
    gateway: readFlag(STATE_GATEWAY, 'unknown'),
    warmup:  readFlag(STATE_WARMUP,  'unknown'),
    ready:   readFlag(STATE_READY,   'false') === 'true',
    pid: process.pid,
    uptime_s: Math.round(process.uptime()),
    model: OPENCLAW_MODEL,
  };
}

// Load workspace context once at boot. If files change you have to restart;
// that is fine — the workspace is part of the deployment config.
function loadWorkspaceContext() {
  const parts = [];
  for (const file of WORKSPACE_FILES) {
    const full = path.join(WORKSPACE_DIR, file);
    try {
      const text = fs.readFileSync(full, 'utf8').trim();
      if (text) parts.push(`# ${file}\n${text}`);
    } catch {
      // missing file is fine, just skip it
    }
  }
  return parts.join('\n\n');
}

const WORKSPACE_CONTEXT = loadWorkspaceContext();
console.log(`[agroclaw] workspace context loaded: ${WORKSPACE_CONTEXT.length} chars`);

function buildPrompt(userMessage) {
  if (!WORKSPACE_CONTEXT) return userMessage;
  return [
    'Eres AgroClaw. Sigue estrictamente la identidad y reglas definidas a continuación.',
    '',
    '=== CONTEXTO ===',
    WORKSPACE_CONTEXT,
    '=== FIN CONTEXTO ===',
    '',
    'Mensaje del usuario:',
    userMessage,
  ].join('\n');
}

// ---------- request queue ----------
let inflight = 0;
const queue = [];

function runQueued(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    drain();
  });
}

function drain() {
  while (inflight < MAX_CONCURRENT && queue.length > 0) {
    const { task, resolve, reject } = queue.shift();
    inflight++;
    task().then(resolve, reject).finally(() => {
      inflight--;
      drain();
    });
  }
}

// ---------- openclaw invocation (agent) ----------
function extractAgentText(parsed) {
  const payloads =
    parsed?.result?.payloads ??
    parsed?.payloads ??
    [];

  if (Array.isArray(payloads)) {
    for (const payload of payloads) {
      if (typeof payload?.text === 'string' && payload.text.trim()) {
        return payload.text.trim();
      }
    }
  }

  const visible =
    parsed?.result?.finalAssistantVisibleText ??
    parsed?.finalAssistantVisibleText ??
    parsed?.result?.finalAssistantRawText ??
    parsed?.finalAssistantRawText;

  if (typeof visible === 'string' && visible.trim()) {
    return visible.trim();
  }

  return '';
}

function callAgent(message) {
  return new Promise((resolve, reject) => {
    const timeoutSeconds = Math.max(
      30,
      Math.floor(OPENCLAW_TIMEOUT_MS / 1000) - 5
    );

    const args = [
      'agent',
      '--agent', OPENCLAW_AGENT_ID,
      '--json',
      '--timeout', String(timeoutSeconds),
      '--model', OPENCLAW_MODEL,
      '--message', message,
    ];

    const child = spawn('openclaw', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const killer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, OPENCLAW_TIMEOUT_MS);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', err => {
      clearTimeout(killer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(killer);

      if (timedOut) {
        return reject(new Error('openclaw_agent_timeout'));
      }

      if (code !== 0) {
        return reject(new Error(
          `openclaw_agent_exit_${code}: stderr=${stderr.slice(0, 500)} stdout=${stdout.slice(0, 500)}`
        ));
      }

      try {
        const parsed = JSON.parse(stdout);

        if (parsed?.status && parsed.status !== 'ok') {
          return reject(new Error(
            `openclaw_agent_not_ok: ${JSON.stringify(parsed).slice(0, 1000)}`
          ));
        }

        const text = extractAgentText(parsed);

        if (!text) {
          return reject(new Error(
            `openclaw_agent_no_text: ${JSON.stringify(parsed).slice(0, 1200)}`
          ));
        }

        resolve(text);
      } catch (err) {
        reject(new Error(
          `openclaw_agent_bad_json: ${err.message} | raw=${stdout.slice(0, 500)}`
        ));
      }
    });
  });
}

// ---------- app ----------
const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, server-to-server
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('cors_denied'));
  },
}));

app.use(express.json({ limit: '64kb' }));

// Liveness: always 200 while Express is up. This is what Coolify watches.
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Readiness/diagnostic: real subsystem state.
app.get('/status', (_req, res) => {
  const s = getStatus();
  res.status(200).json({ ...s, workspace_context_chars: WORKSPACE_CONTEXT.length });
});

// Chat endpoint
app.post('/api/agroclaw/chat', async (req, res) => {
  const s = getStatus();
  if (!s.ready) {
    res.set('Retry-After', '20');
    return res.status(503).json({
      error: 'warming',
      status: s,
      message: 'AgroClaw is warming up. Retry shortly.',
    });
  }

  const userMessage = (req.body && typeof req.body.message === 'string') ? req.body.message : '';
  if (!userMessage) {
    return res.status(400).json({ error: 'missing_message' });
  }
  if (userMessage.length > MAX_PROMPT_CHARS) {
    return res.status(413).json({ error: 'prompt_too_long', max: MAX_PROMPT_CHARS });
  }

  try {
    const t0 = Date.now();
    const reply = await runQueued(() => callAgent(userMessage));
    const elapsed_ms = Date.now() - t0;
    return res.status(200).json({ reply, elapsed_ms });
  } catch (err) {
    const msg = (err && err.message) || 'agent_error';
    const status = msg === 'openclaw_agent_timeout' ? 504 : 502;
    console.error('[agroclaw] chat error:', msg);
    return res.status(status).json({ error: msg });
  }
});

// 404 fallthrough
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[agroclaw] express listening on :${PORT}`);
  console.log(`[agroclaw] model: ${OPENCLAW_MODEL}`);
  console.log(`[agroclaw] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

function shutdown(signal) {
  console.log(`[agroclaw] received ${signal}, closing...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
