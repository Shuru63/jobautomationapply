import Groq from "groq-sdk";

export type GroqOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export async function callGroq(
  systemPrompt: string,
  userMessage: string,
  options?: GroqOptions
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: options?.model || "llama-3.3-70b-versatile",
    max_tokens: options?.maxTokens || 4096,
    temperature: options?.temperature ?? 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const choice = completion.choices[0];
  return {
    content: choice.message.content || "",
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  };
}

export async function callGroqJSON<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  options?: GroqOptions
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const fullSystem = `${systemPrompt}\n\nRespond with valid JSON only.`;
  const response = await callGroq(fullSystem, userMessage, { ...options, temperature: 0.1 });

  let parsed: T;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse Groq response as JSON");
  }

  return { data: parsed, inputTokens: response.inputTokens, outputTokens: response.outputTokens };
}