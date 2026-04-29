import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || "main";
const OPENCLAW_COMMAND = process.env.OPENCLAW_COMMAND || "openclaw";
const OPENCLAW_TIMEOUT_MS = Number(process.env.OPENCLAW_TIMEOUT_MS || 180000);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,https://agroclaw-demo.netlify.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
}));

app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "agroclaw-demo-bridge",
    agent: OPENCLAW_AGENT_ID,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "agroclaw-demo-bridge",
    agent: OPENCLAW_AGENT_ID,
    allowedOrigins,
  });
});

function cleanOpenClawOutput(rawOutput) {
  const lines = rawOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const filtered = lines.filter((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("🦞 OpenClaw")) return false;
    if (trimmed.startsWith("I'm not saying")) return false;
    if (trimmed.startsWith("Hot reload")) return false;
    if (trimmed.startsWith("Ah,")) return false;
    if (trimmed === "│") return false;
    if (trimmed === "◇") return false;
    if (trimmed.startsWith("◇")) return false;

    return true;
  });

  return filtered.join("\n").trim();
}

app.post("/api/agroclaw/chat", (req, res) => {
  const prompt = req.body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      error: "Missing prompt",
    });
  }

  let responseSent = false;

  const child = spawn(
    OPENCLAW_COMMAND,
    ["agent", "--agent", OPENCLAW_AGENT_ID, "--message", prompt],
    {
      env: process.env,
    }
  );

  let stdout = "";
  let stderr = "";

  const timeout = setTimeout(() => {
    if (responseSent) return;

    responseSent = true;
    child.kill("SIGTERM");

    res.status(504).json({
      error: "OpenClaw request timed out",
      timeoutMs: OPENCLAW_TIMEOUT_MS,
      stdout,
      stderr,
    });
  }, OPENCLAW_TIMEOUT_MS);

  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  child.on("error", (error) => {
    if (responseSent) return;

    clearTimeout(timeout);
    responseSent = true;

    res.status(500).json({
      error: `Failed to start OpenClaw: ${error.message}`,
      command: OPENCLAW_COMMAND,
    });
  });

  child.on("close", (code) => {
    if (responseSent) return;

    clearTimeout(timeout);
    responseSent = true;

    if (code !== 0) {
      return res.status(500).json({
        error: "OpenClaw command failed",
        code,
        stderr,
        stdout,
      });
    }

    res.json({
      answer: cleanOpenClawOutput(stdout),
      raw: stdout,
    });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`AgroClaw demo bridge listening on http://${HOST}:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
