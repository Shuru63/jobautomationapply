import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options?: GeminiOptions
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options?.model || "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

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
}

export async function callGeminiJSON<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  options?: GeminiOptions
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options?.model || "gemini-2.5-flash",
    systemInstruction: `${systemPrompt}\n\nYou MUST respond with valid JSON only. No markdown, no explanation, no code fences.`,
  });

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

  // Clean the response: strip markdown code fences if present
  let cleaned = rawText.trim();
  // Remove ```json ... ``` or ``` ... ``` wrappers
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // As a last resort, extract the first {...} or [...] block
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
}