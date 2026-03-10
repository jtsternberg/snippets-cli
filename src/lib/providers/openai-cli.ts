import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

function isCodexCliAvailable(): boolean {
  try {
    execSync("which codex", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class OpenAICliProvider implements LlmProvider {
  name = "openai-cli" as const;

  async isAvailable(): Promise<boolean> {
    return isCodexCliAvailable();
  }

  async generate(prompt: string): Promise<string | null> {
    if (!isCodexCliAvailable()) return null;
    const config = loadConfig();
    try {
      const escaped = prompt.replace(/'/g, "'\\''");
      const result = execSync(
        `codex exec --model ${config.llm.codexCliModel} '${escaped}'`,
        { timeout: 60_000, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
      );
      return result?.trim() || null;
    } catch {
      return null;
    }
  }
}
