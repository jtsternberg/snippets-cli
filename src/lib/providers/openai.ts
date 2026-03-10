import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY || loadConfig().llm.openaiApiKey || null;
}

export class OpenAIProvider implements LlmProvider {
  name = "openai" as const;

  async isAvailable(): Promise<boolean> {
    return getApiKey() !== null;
  }

  async generate(prompt: string): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const config = loadConfig();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const resp = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.llm.openaiModel,
          temperature: 0.1,
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      clearTimeout(timeout);

      if (!resp.ok) return null;
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }
}
