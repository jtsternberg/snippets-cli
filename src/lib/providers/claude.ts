import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || loadConfig().llm.anthropicApiKey || null;
}

export class ClaudeProvider implements LlmProvider {
  name = "claude" as const;

  async isAvailable(): Promise<boolean> {
    return getApiKey() !== null;
  }

  async generate(prompt: string): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const config = loadConfig();
    try {
      const resp = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.llm.anthropicModel,
          max_tokens: 256,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!resp.ok) return null;
      const data = (await resp.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.[0]?.text?.trim() || null;
    } catch {
      return null;
    }
  }
}
