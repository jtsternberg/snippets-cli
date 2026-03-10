import { loadConfig } from "../config.js";
import type { LlmProviderName } from "../../types/index.js";
import type { LlmProvider } from "./types.js";
import { OllamaProvider } from "./ollama.js";
import { GeminiProvider } from "./gemini.js";
import { GeminiCliProvider } from "./gemini-cli.js";
import { ClaudeProvider } from "./claude.js";
import { ClaudeCliProvider } from "./claude-cli.js";
import { OpenAIProvider } from "./openai.js";
import { OpenAICliProvider } from "./openai-cli.js";
import { isDebugMode as _isDebugMode } from "./debug.js";

export type { LlmProvider } from "./types.js";
export { setDebugMode, isDebugMode } from "./debug.js";

const providers: Record<string, LlmProvider> = {
  ollama: new OllamaProvider(),
  gemini: new GeminiProvider(),
  "gemini-cli": new GeminiCliProvider(),
  claude: new ClaudeProvider(),
  "claude-cli": new ClaudeCliProvider(),
  openai: new OpenAIProvider(),
  "openai-cli": new OpenAICliProvider(),
};

// Auto mode tries CLI providers first (no key needed), then API providers
const AUTO_ORDER: LlmProviderName[] = [
  "gemini-cli", "claude-cli", "openai-cli",
  "ollama",
  "gemini", "claude", "openai",
];

/** CLI override for --provider flag. Set before calling callLlm/isLlmAvailable. */
let providerOverride: LlmProviderName | null = null;

export function setProviderOverride(name: LlmProviderName | null): void {
  providerOverride = name;
}

function getProviderChain(): LlmProvider[] {
  // CLI --provider flag takes priority
  if (providerOverride) {
    if (providerOverride === "auto") {
      return AUTO_ORDER.map((n) => providers[n]).filter(Boolean);
    }
    const p = providers[providerOverride];
    return p ? [p] : [];
  }

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
export async function callLlm(prompt: string, label?: string): Promise<string | null> {
  const chain = getProviderChain();
  const tag = label ? ` [${label}]` : "";

  for (const provider of chain) {
    if (await provider.isAvailable()) {
      if (_isDebugMode()) {
        console.error(`[debug]${tag} Using provider: ${provider.name}`);
      }
      const result = await provider.generate(prompt);
      if (_isDebugMode()) {
        console.error(`[debug]${tag} Response (${result?.length ?? 0} chars): ${result ?? "(null)"}`);
      }
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
