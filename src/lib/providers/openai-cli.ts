import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";
import { cliExec } from "./cli-exec.js";

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
    return cliExec({
      cmd: "codex",
      args: ["exec", "--model", config.llm.codexCliModel],
      prompt,
      timeout: 60_000,
    });
  }
}
