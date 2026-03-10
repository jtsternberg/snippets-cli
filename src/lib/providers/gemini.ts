import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || loadConfig().llm.geminiApiKey || null;
}

export class GeminiProvider implements LlmProvider {
  name = "gemini" as const;

  async isAvailable(): Promise<boolean> {
    return getApiKey() !== null;
  }

  async generate(prompt: string): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const config = loadConfig();
    const model = config.llm.geminiModel;
    const url = `${GEMINI_API_URL}/${model}:generateContent`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });
      clearTimeout(timeout);

      if (!resp.ok) return null;
      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch {
      return null;
    }
  }
}
