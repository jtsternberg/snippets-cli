import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

export class OllamaProvider implements LlmProvider {
  name = "ollama" as const;

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`${config.llm.ollamaHost}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return resp.ok;
    } catch {
      return false;
    }
  }

  async generate(prompt: string): Promise<string | null> {
    const config = loadConfig();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const resp = await fetch(`${config.llm.ollamaHost}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.llm.ollamaModel,
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
      });
      clearTimeout(timeout);

      if (!resp.ok) return null;
      const data = (await resp.json()) as { response: string };
      return data.response?.trim() || null;
    } catch {
      return null;
    }
  }
}
