import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";

function isClaudeCliAvailable(): boolean {
  try {
    execSync("which claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class ClaudeCliProvider implements LlmProvider {
  name = "claude-cli" as const;

  async isAvailable(): Promise<boolean> {
    return isClaudeCliAvailable();
  }

  async generate(prompt: string): Promise<string | null> {
    if (!isClaudeCliAvailable()) return null;
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
