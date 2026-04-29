// AgroClaw Express bridge (ESM)
// - GET  /health   → 200 always while Express is alive (Coolify liveness)
// - GET  /status   → real status (gateway + warmup + ready)
// - POST /api/agroclaw/chat → 503 until ready, then proxies to OpenClaw
//
// Inference path: `openclaw infer model run --gateway --json --model ... --prompt ...`
// Latency target: ~10-20 s per turn (vs ~100 s with `openclaw agent`).
//
// To preserve AgroClaw's personality without paying the agent loop cost, we read
// the workspace markdown files once at startup and prepend them to every prompt
// as a system context. This is a pragmatic middle ground; full agent loop with
// tools/memory would require an ACP WebSocket bridge (next iteration).

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
const OPENCLAW_TIMEOUT_MS = parseInt(process.env.OPENCLAW_TIMEOUT_MS || '120000', 10);
const MAX_PROMPT_CHARS = parseInt(process.env.MAX_PROMPT_CHARS || '4000', 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '2', 10);

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

// ---------- openclaw invocation (infer model run) ----------
function callModel(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      'infer', 'model', 'run',
      '--gateway',
      '--json',
      '--model', OPENCLAW_MODEL,
      '--prompt', prompt,
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
      if (timedOut) return reject(new Error('openclaw_timeout'));
      if (code !== 0) {
        return reject(new Error(`openclaw_exit_${code}: ${stderr.slice(0, 500)}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (!parsed.ok) {
          return reject(new Error(`openclaw_not_ok: ${JSON.stringify(parsed).slice(0, 500)}`));
        }
        const text = parsed?.outputs?.[0]?.text;
        if (typeof text !== 'string') {
          return reject(new Error('openclaw_no_text_in_outputs'));
        }
        resolve(text.trim());
      } catch (err) {
        reject(new Error(`openclaw_bad_json: ${err.message} | raw=${stdout.slice(0, 300)}`));
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

  const fullPrompt = buildPrompt(userMessage);

  try {
    const t0 = Date.now();
    const reply = await runQueued(() => callModel(fullPrompt));
    const elapsed_ms = Date.now() - t0;
    return res.status(200).json({ reply, elapsed_ms });
  } catch (err) {
    const msg = (err && err.message) || 'agent_error';
    const status = msg === 'openclaw_timeout' ? 504 : 502;
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
