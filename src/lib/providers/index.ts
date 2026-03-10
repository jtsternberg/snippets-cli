import { loadConfig } from "../config.js";
import type { LlmProviderName } from "../../types/index.js";
import type { LlmProvider } from "./types.js";
import { OllamaProvider } from "./ollama.js";
import { GeminiProvider } from "./gemini.js";
import { ClaudeProvider } from "./claude.js";
import { OpenAIProvider } from "./openai.js";

export type { LlmProvider } from "./types.js";

const providers: Record<string, LlmProvider> = {
  ollama: new OllamaProvider(),
  gemini: new GeminiProvider(),
  claude: new ClaudeProvider(),
  openai: new OpenAIProvider(),
};

// Auto mode tries providers in this order
const AUTO_ORDER: LlmProviderName[] = ["gemini", "ollama", "claude", "openai"];

function getProviderChain(): LlmProvider[] {
  const config = loadConfig();
  const chain: LlmProvider[] = [];

  if (config.llm.provider === "auto") {
    // Auto mode: try all in preferred order
    for (const name of AUTO_ORDER) {
      const p = providers[name];
      if (p) chain.push(p);
    }
  } else {
    // Explicit primary provider
    const primary = providers[config.llm.provider];
    if (primary) chain.push(primary);

    // Optional fallback
    if (config.llm.fallbackProvider && config.llm.fallbackProvider !== config.llm.provider) {
      const fallback = providers[config.llm.fallbackProvider];
      if (fallback) chain.push(fallback);
    }
  }

  return chain;
}

/**
 * Call an LLM using the configured provider chain.
 * Tries each provider in order until one succeeds.
 */
export async function callLlm(prompt: string): Promise<string | null> {
  const chain = getProviderChain();

  for (const provider of chain) {
    if (await provider.isAvailable()) {
      const result = await provider.generate(prompt);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Check if any configured LLM provider is available.
 */
export async function isLlmAvailable(): Promise<boolean> {
  const chain = getProviderChain();
  for (const provider of chain) {
    if (await provider.isAvailable()) return true;
  }
  return false;
}

export function getProvider(name: string): LlmProvider | undefined {
  return providers[name];
}

export function getProviderNames(): string[] {
  return Object.keys(providers);
}
