import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || "main";
const OPENCLAW_COMMAND = process.env.OPENCLAW_COMMAND || "openclaw";
const OPENCLAW_TIMEOUT_MS = Number(process.env.OPENCLAW_TIMEOUT_MS || 300000);
const OPENCLAW_GATEWAY_READY_URL =
  process.env.OPENCLAW_GATEWAY_READY_URL || "http://127.0.0.1:18789/readyz";

const MAX_PROMPT_CHARS = Number(process.env.MAX_PROMPT_CHARS || 4000);
const MAX_CONCURRENT_REQUESTS = Number(process.env.MAX_CONCURRENT_REQUESTS || 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  "https://agroclaw-demo.netlify.app,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

let runningRequests = 0;
const pendingQueue = [];

function enqueue(task) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      runningRequests += 1;

      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      } finally {
        runningRequests -= 1;

        const next = pendingQueue.shift();
        if (next) {
          next();
        }
      }
    };

    if (runningRequests < MAX_CONCURRENT_REQUESTS) {
      run();
    } else {
      pendingQueue.push(run);
    }
  });
}

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json({ limit: "2mb" }));

function cleanOpenClawOutput(rawOutput) {
  const lines = rawOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const filtered = lines.filter((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("OpenClaw")) return false;
    if (trimmed.startsWith("◇")) return false;
    if (trimmed === "◇") return false;
    if (trimmed === "│") return false;
    if (trimmed.startsWith("Hot reload")) return false;

    return true;
  });

  return filtered.join("\n").trim();
}

async function checkGatewayReady() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(OPENCLAW_GATEWAY_READY_URL, {
      signal: controller.signal
    });

    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runOpenClaw(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      OPENCLAW_COMMAND,
      ["agent", "--agent", OPENCLAW_AGENT_ID, "--message", prompt],
      {
        env: process.env
      }
    );

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");

      reject({
        status: 504,
        payload: {
          error: "OpenClaw request timed out",
          timeoutMs: OPENCLAW_TIMEOUT_MS,
          stdout,
          stderr
        }
      });
    }, OPENCLAW_TIMEOUT_MS);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);

      reject({
        status: 500,
        payload: {
          error: `Failed to start OpenClaw: ${error.message}`,
          command: OPENCLAW_COMMAND
        }
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject({
          status: 500,
          payload: {
            error: "OpenClaw command failed",
            code,
            stderr,
            stdout
          }
        });
        return;
      }

      resolve({
        answer: cleanOpenClawOutput(stdout),
        raw: stdout
      });
    });
  });
}

app.get("/health", async (_req, res) => {
  const gateway = await checkGatewayReady();

  const status = gateway.ok ? 200 : 503;

  res.status(status).json({
    ok: gateway.ok,
    service: "agroclaw-backend",
    bridge: true,
    gateway,
    agent: OPENCLAW_AGENT_ID,
    queue: {
      runningRequests,
      pendingRequests: pendingQueue.length,
      maxConcurrentRequests: MAX_CONCURRENT_REQUESTS
    }
  });
});

app.post("/api/agroclaw/chat", async (req, res) => {
  const prompt = req.body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      error: "Missing prompt"
    });
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(413).json({
      error: "Prompt too long",
      maxPromptChars: MAX_PROMPT_CHARS
    });
  }

  const gateway = await checkGatewayReady();

  if (!gateway.ok) {
    return res.status(503).json({
      error: "OpenClaw Gateway is not ready",
      gateway
    });
  }

  try {
    const result = await enqueue(() => runOpenClaw(prompt));
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json(error.payload || { error: String(error) });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

app.listen(PORT, HOST, () => {
  console.log(`AgroClaw backend listening on http://${HOST}:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
