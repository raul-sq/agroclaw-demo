import type { AgroClawRequest, AgroClawResponse } from "../types/agroclaw";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const AGROCLAW_ENDPOINT =
  import.meta.env.VITE_AGROCLAW_ENDPOINT ?? "/api/agroclaw/chat";

function normalizeAnswer(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    const possibleAnswer =
      obj.answer ??
      obj.response ??
      obj.message ??
      obj.output ??
      obj.output_text ??
      obj.text;

    if (typeof possibleAnswer === "string") {
      return possibleAnswer;
    }
  }

  return JSON.stringify(data, null, 2);
}

export async function askAgroClaw(prompt: string): Promise<AgroClawResponse> {
  const payload: AgroClawRequest = {
    prompt,
    mode: "demo",
    source: "agroclaw-demo-frontend",
  };

  const response = await fetch(`${API_BASE_URL}${AGROCLAW_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `AgroClaw backend error ${response.status}: ${
        errorText || response.statusText
      }`
    );
  }

  const data = await response.json();

  return {
    answer: normalizeAnswer(data),
  };
}
