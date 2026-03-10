import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

function isGeminiCliAvailable(): boolean {
  try {
    execSync("which gemini", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class GeminiCliProvider implements LlmProvider {
  name = "gemini-cli" as const;

  async isAvailable(): Promise<boolean> {
    return isGeminiCliAvailable();
  }

  async generate(prompt: string): Promise<string | null> {
    if (!isGeminiCliAvailable()) return null;
    const config = loadConfig();
    try {
      const escaped = prompt.replace(/'/g, "'\\''");
      const result = execSync(
        `gemini --model ${config.llm.geminiCliModel} -p '${escaped}'`,
        { timeout: 45_000, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
      );
      return result?.trim() || null;
    } catch {
      return null;
    }
  }
}
