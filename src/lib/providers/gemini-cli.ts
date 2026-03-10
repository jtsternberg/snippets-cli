import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import type { LlmProvider } from "./types.js";
import { cliExec } from "./cli-exec.js";

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
    return cliExec({
      cmd: "gemini",
      args: ["--model", config.llm.geminiCliModel, "-p"],
      prompt,
      timeout: 45_000,
    });
  }
}
