import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";
import { cliExec } from "./cli-exec.js";

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
    return cliExec({
      cmd: "claude",
      args: ["--model", config.llm.claudeCliModel, "-p"],
      prompt,
      timeout: 45_000,
    });
  }
}
