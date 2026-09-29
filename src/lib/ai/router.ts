import { callGemini, callGeminiJSON } from "./providers/gemini";
import { callGroq, callGroqJSON } from "./providers/groq";
import { callOpenRouter, callOpenRouterJSON } from "./providers/openrouter";
import { callOllama, callOllamaJSON } from "./providers/ollama";

export type AIProvider = "gemini" | "groq" | "openrouter" | "ollama";

export type AITask =
  | "cv_parsing"         // Complex: Gemini or Claude
  | "job_analysis"       // Complex: Gemini or Claude
  | "resume_generation"  // Complex: Gemini or Claude
  | "cover_letter"       // Complex: Gemini or Claude
  | "interview_prep"     // Complex: Gemini or Claude
  | "question_answer"    // Medium: Gemini or Claude
  | "skill_extraction"   // Fast: Groq or Gemini Flash
  | "classification"     // Fast: Groq
  | "normalization"      // Fast: Groq
  | "email_classify"     // Fast: Groq
  | "dedup_assist";      // Fast: Groq

// Which provider to use for each task type
const TASK_PROVIDER_MAP: Record<AITask, AIProvider[]> = {
  cv_parsing:        ["gemini", "openrouter"],
  job_analysis:      ["gemini", "openrouter"],
  resume_generation: ["gemini", "openrouter"],
  cover_letter:      ["gemini", "openrouter"],
  interview_prep:    ["gemini", "openrouter"],
  question_answer:   ["gemini", "openrouter"],
  skill_extraction:  ["groq", "gemini", "ollama"],
  classification:    ["groq", "gemini", "ollama"],
  normalization:     ["groq", "gemini", "ollama"],
  email_classify:    ["groq", "gemini", "ollama"],
  dedup_assist:      ["groq", "gemini", "ollama"],
};

function getAvailableProviders(): AIProvider[] {
  const available: AIProvider[] = [];
  if (process.env.GEMINI_API_KEY) available.push("gemini");
  if (process.env.GROQ_API_KEY) available.push("groq");
  if (process.env.OPENROUTER_API_KEY) available.push("openrouter");
  // Ollama only if explicitly configured or as last-resort fallback
  if (process.env.OLLAMA_BASE_URL || available.length === 0) {
    available.push("ollama");
  }
  return available;
}

function selectProvider(task: AITask): AIProvider {
  const available = getAvailableProviders();
  const preferred = TASK_PROVIDER_MAP[task];

  for (const provider of preferred) {
    if (available.includes(provider)) return provider;
  }

  // Fallback chain
  if (available.includes("gemini")) return "gemini";
  if (available.includes("groq")) return "groq";
  if (available.includes("openrouter")) return "openrouter";
  return "ollama";
}

export type AIRouterResponse = {
  content: string;
  provider: AIProvider;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export async function routeAI(
  task: AITask,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number; forceProvider?: AIProvider }
): Promise<AIRouterResponse> {
  const provider = options?.forceProvider || selectProvider(task);
  const startTime = Date.now();

  try {
    let result: { content: string; inputTokens: number; outputTokens: number };

    switch (provider) {
      case "gemini":
        result = await callGemini(systemPrompt, userMessage, options);
        break;
      case "groq":
        result = await callGroq(systemPrompt, userMessage, options);
        break;
      case "openrouter":
        result = await callOpenRouter(systemPrompt, userMessage, options);
        break;
      case "ollama":
        result = await callOllama(systemPrompt, userMessage, options);
        break;
    }

    return {
      ...result,
      provider,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    // Try fallback providers
    const fallbacks = TASK_PROVIDER_MAP[task].filter((p) => p !== provider);
    for (const fallback of fallbacks) {
      try {
        let result: { content: string; inputTokens: number; outputTokens: number };
        switch (fallback) {
          case "gemini":
            result = await callGemini(systemPrompt, userMessage, options);
            break;
          case "groq":
            result = await callGroq(systemPrompt, userMessage, options);
            break;
          case "openrouter":
            result = await callOpenRouter(systemPrompt, userMessage, options);
            break;
          case "ollama":
            result = await callOllama(systemPrompt, userMessage, options);
            break;
        }
        return { ...result, provider: fallback, durationMs: Date.now() - startTime };
      } catch {
        continue;
      }
    }
    throw err;
  }
}

export async function routeAIJSON<T = Record<string, unknown>>(
  task: AITask,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number; forceProvider?: AIProvider }
): Promise<{ data: T } & AIRouterResponse> {
  const provider = options?.forceProvider || selectProvider(task);
  const startTime = Date.now();

  let result: { data: T; inputTokens: number; outputTokens: number };

  switch (provider) {
    case "gemini":
      result = await callGeminiJSON<T>(systemPrompt, userMessage, options);
      break;
    case "groq":
      result = await callGroqJSON<T>(systemPrompt, userMessage, options);
      break;
    case "openrouter":
      result = await callOpenRouterJSON<T>(systemPrompt, userMessage, options);
      break;
    case "ollama":
      result = await callOllamaJSON<T>(systemPrompt, userMessage, options);
      break;
  }

  try {
    let result: { data: T; inputTokens: number; outputTokens: number };

    switch (provider) {
      case "gemini":
        result = await callGeminiJSON<T>(systemPrompt, userMessage, options);
        break;
      case "groq":
        result = await callGroqJSON<T>(systemPrompt, userMessage, options);
        break;
      case "openrouter":
        result = await callOpenRouterJSON<T>(systemPrompt, userMessage, options);
        break;
      case "ollama":
        result = await callOllamaJSON<T>(systemPrompt, userMessage, options);
        break;
    }

    return {
      ...result!,
      content: JSON.stringify(result!.data),
      provider,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    // Try fallback providers
    const fallbacks = TASK_PROVIDER_MAP[task].filter((p) => p !== provider);
    for (const fallback of fallbacks) {
      try {
        let result: { data: T; inputTokens: number; outputTokens: number };
        switch (fallback) {
          case "gemini":
            result = await callGeminiJSON<T>(systemPrompt, userMessage, options);
            break;
          case "groq":
            result = await callGroqJSON<T>(systemPrompt, userMessage, options);
            break;
          case "openrouter":
            result = await callOpenRouterJSON<T>(systemPrompt, userMessage, options);
            break;
          case "ollama":
            result = await callOllamaJSON<T>(systemPrompt, userMessage, options);
            break;
        }
        return {
          ...result!,
          content: JSON.stringify(result!.data),
          provider: fallback,
          durationMs: Date.now() - startTime,
        };
      } catch {
        continue;
      }
    }
    throw err;
  }
}