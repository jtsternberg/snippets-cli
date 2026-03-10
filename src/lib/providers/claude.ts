import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function getApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || loadConfig().llm.anthropicApiKey || null;
}

function isClaudeCliAvailable(): boolean {
  try {
    execSync("which claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class ClaudeProvider implements LlmProvider {
  name = "claude" as const;

  async isAvailable(): Promise<boolean> {
    return getApiKey() !== null || isClaudeCliAvailable();
  }

  async generate(prompt: string): Promise<string | null> {
    const apiKey = getApiKey();

    // Prefer API if key is available
    if (apiKey) {
      return this.generateViaApi(prompt, apiKey);
    }

    // Fall back to CLI
    if (isClaudeCliAvailable()) {
      return this.generateViaCli(prompt);
    }

    return null;
  }

  private async generateViaApi(prompt: string, apiKey: string): Promise<string | null> {
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

  private generateViaCli(prompt: string): string | null {
    const config = loadConfig();
    try {
      const escaped = prompt.replace(/'/g, "'\\''");
      const result = execSync(
        `claude --model ${config.llm.claudeCliModel} -p '${escaped}'`,
        { timeout: 45_000, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
      );
      return result?.trim() || null;
    } catch {
      return null;
    }
  }
}
