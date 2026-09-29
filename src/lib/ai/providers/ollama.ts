export type OllamaOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export async function callOllama(
  systemPrompt: string,
  userMessage: string,
  options?: OllamaOptions
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = options?.model || "llama3.1";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.maxTokens || 4096,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const data = await res.json();
  return {
    content: data.message?.content || "",
    inputTokens: data.prompt_eval_count || 0,
    outputTokens: data.eval_count || 0,
  };
}

export async function callOllamaJSON<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  options?: OllamaOptions
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const fullSystem = `${systemPrompt}\n\nRespond with valid JSON only.`;
  const response = await callOllama(fullSystem, userMessage, options);

  let parsed: T;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Failed to parse Ollama response as JSON");
  }

  return { data: parsed, inputTokens: response.inputTokens, outputTokens: response.outputTokens };
}