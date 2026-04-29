// AgroClaw Express bridge
// - GET  /health   → 200 always while Express is alive (Coolify liveness)
// - GET  /status   → real status (gateway + warmup + ready)
// - POST /api/agroclaw/chat → 503 until ready, then proxies to OpenClaw agent

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ---------- config ----------
const PORT = parseInt(process.env.PORT || '3000', 10);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://agroclaw-demo.netlify.app,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const OPENCLAW_TIMEOUT_MS = parseInt(process.env.OPENCLAW_TIMEOUT_MS || '300000', 10);
const MAX_PROMPT_CHARS = parseInt(process.env.MAX_PROMPT_CHARS || '4000', 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1', 10);

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
  };
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

// ---------- openclaw invocation ----------
function callAgent(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['agent', '--agent', OPENCLAW_AGENT_ID, '--message', prompt];
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
      if (code !== 0) return reject(new Error(`openclaw_exit_${code}: ${stderr.slice(0, 500)}`));
      resolve(stdout.trim());
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
  res.status(200).json(s);
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

  const prompt = (req.body && typeof req.body.message === 'string') ? req.body.message : '';
  if (!prompt) {
    return res.status(400).json({ error: 'missing_message' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(413).json({ error: 'prompt_too_long', max: MAX_PROMPT_CHARS });
  }

  try {
    const reply = await runQueued(() => callAgent(prompt));
    return res.status(200).json({ reply });
  } catch (err) {
    const msg = (err && err.message) || 'agent_error';
    const status = msg === 'openclaw_timeout' ? 504 : 502;
    return res.status(status).json({ error: msg });
  }
});

// 404 fallthrough
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[agroclaw] express listening on :${PORT}`);
  console.log(`[agroclaw] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

function shutdown(signal) {
  console.log(`[agroclaw] received ${signal}, closing...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
