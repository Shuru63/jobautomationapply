import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

// ── Rate-limit aware retry helper ─────────────────────────────────────────────
// Parses the retryDelay from Gemini 429/503 errors and waits before retrying.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseRetryDelay(err: unknown): number {
  const msg = String(err instanceof Error ? err.message : err);
  // Parse "Please retry in 43.48s" or "retryDelay":"43s"
  const match = msg.match(/retry(?:Delay)?["\s:]+(\d+(?:\.\d+)?)\s*s/i) ||
                msg.match(/retry in (\d+(?:\.\d+)?)/i);
  if (match) return Math.ceil(parseFloat(match[1])) * 1000;
  return 15000; // default 15s
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err);
  return msg.includes("429") || msg.includes("503") || msg.includes("quota") || msg.includes("overloaded");
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && attempt < maxRetries) {
        const delay = parseRetryDelay(err);
        console.warn(`[Gemini] Rate limited. Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

// ── Core text generation ──────────────────────────────────────────────────────

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options?: GeminiOptions
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options?.model || "gemini-flash-lite-latest",
    systemInstruction: systemPrompt,
  });

  return withRetry(async () => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.3,
      },
    });

    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
    };
  });
}

// ── JSON generation with retry + cleaning ─────────────────────────────────────

export async function callGeminiJSON<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  options?: GeminiOptions
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options?.model || "gemini-flash-lite-latest",
    systemInstruction: `${systemPrompt}\n\nYou MUST respond with valid JSON only. No markdown, no explanation, no code fences.`,
  });

  return withRetry(async () => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.3,
        responseMimeType: "application/json",
      },
    });

    const response = result.response;
    const rawText = response.text();
    const usage = response.usageMetadata;

    // Clean: strip markdown code fences if present
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    // Last resort: extract first {...} or [...] block
    if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) cleaned = match[0];
    }

    let parsed: T;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Failed to parse Gemini JSON response: ${(err as Error).message}. Raw: ${rawText.substring(0, 200)}`);
    }

    return {
      data: parsed,
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
    };
  });
}