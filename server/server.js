import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";

const app = express();
const PORT = 3000;

app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "agroclaw-demo-bridge",
    agent: "main",
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

  const child = spawn(
    "openclaw",
    ["agent", "--agent", "main", "--message", prompt],
    {
      env: process.env,
    }
  );

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  child.on("error", (error) => {
    res.status(500).json({
      error: `Failed to start OpenClaw: ${error.message}`,
    });
  });

  child.on("close", (code) => {
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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`AgroClaw demo bridge listening on http://127.0.0.1:${PORT}`);
});
