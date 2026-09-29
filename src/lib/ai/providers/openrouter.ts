export type OpenRouterOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  options?: OpenRouterOptions
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = options?.model || "anthropic/claude-3.5-sonnet";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

export async function callOpenRouterJSON<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  options?: OpenRouterOptions
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const fullSystem = `${systemPrompt}\n\nRespond with valid JSON only.`;
  const response = await callOpenRouter(fullSystem, userMessage, options);

  let parsed: T;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse OpenRouter response as JSON");
  }

  return { data: parsed, inputTokens: response.inputTokens, outputTokens: response.outputTokens };
}