import { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  configExists,
  getLibraryPath,
} from "../lib/config.js";
import { getProviderNames } from "../lib/providers/index.js";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { EXIT_CODES } from "../types/index.js";
import type { LlmProviderName } from "../types/index.js";

export const configCommand = new Command("config")
  .description("View or modify configuration")
  .argument("[key]", "Config key to get or set")
  .argument("[value]", "Value to set")
  .option("--json", "Output full config as JSON")
  .action(async (key: string | undefined, value: string | undefined, opts: { json?: boolean }) => {
    if (!configExists()) {
      console.error("No config found. Run `snip init` first.");
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    const config = loadConfig();

    // Show full config
    if (!key || opts.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    // Handle special "types" subcommands
    if (key === "types") {
      if (!value) {
        console.log(config.types.join("\n"));
        return;
      }

      // "types add <name>" or "types remove <name>"
      // The value here would be "add" and we'd need a third arg
      // For simplicity, just show types if no subcommand
      console.log(config.types.join("\n"));
      return;
    }

    // Get a config value
    if (!value) {
      const val = getNestedValue(config as unknown as Record<string, unknown>, key);
      if (val === undefined) {
        console.error(`Unknown config key: ${key}`);
        process.exit(EXIT_CODES.CONFIG_ERROR);
      }
      console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val));
      return;
    }

    // Set a config value
    setNestedValue(config as unknown as Record<string, unknown>, key, value);
    saveConfig(config);
    console.log(`Set ${key} = ${value}`);
  });

// Subcommand for adding types
export const configTypesAddCommand = new Command("config:types:add")
  .description("Add a new snippet type directory")
  .argument("<name>", "Type name to add")
  .action(async (name: string) => {
    const config = loadConfig();

    if (config.types.includes(name)) {
      console.log(`Type "${name}" already exists.`);
      return;
    }

    config.types.push(name);
    saveConfig(config);

    // Create the directory
    const typeDir = resolve(getLibraryPath(config), name);
    mkdirSync(typeDir, { recursive: true });

    console.log(`Added type "${name}" and created ${typeDir}/`);
  });

const VALID_PROVIDERS = ["ollama", "gemini", "claude", "openai", "auto"];

// Show current LLM configuration
export const configLlmCommand = new Command("config:llm")
  .description("View LLM provider configuration")
  .action(async () => {
    const config = loadConfig();
    const available = getProviderNames();
    console.log(`Provider:  ${config.llm.provider}`);
    console.log(`Fallback:  ${config.llm.fallbackProvider || "(none)"}`);
    console.log(`Available: ${available.join(", ")}`);
    console.log();
    console.log(`Ollama:    model=${config.llm.ollamaModel}  host=${config.llm.ollamaHost}`);
    console.log(`Gemini:    model=${config.llm.geminiModel}  key=${config.llm.geminiApiKey ? "***" : "(not set)"}`);
    console.log(`Claude:    api-model=${config.llm.anthropicModel}  cli-model=${config.llm.claudeCliModel}  key=${config.llm.anthropicApiKey ? "***" : "(not set)"}`);
    console.log(`OpenAI:    model=${config.llm.openaiModel}  key=${config.llm.openaiApiKey ? "***" : "(not set)"}`);
  });

// Set primary LLM provider
export const configLlmProviderCommand = new Command("config:llm:provider")
  .description("Set the primary LLM provider")
  .argument("<provider>", `Provider name (${VALID_PROVIDERS.join(", ")})`)
  .action(async (provider: string) => {
    if (!VALID_PROVIDERS.includes(provider)) {
      console.error(`Invalid provider "${provider}". Choose from: ${VALID_PROVIDERS.join(", ")}`);
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }
    const config = loadConfig();
    config.llm.provider = provider as LlmProviderName;
    saveConfig(config);
    console.log(`LLM provider set to: ${provider}`);
  });

// Set fallback LLM provider
export const configLlmFallbackCommand = new Command("config:llm:fallback")
  .description("Set the fallback LLM provider")
  .argument("<provider>", `Provider name (${VALID_PROVIDERS.join(", ")}) or "none" to clear`)
  .action(async (provider: string) => {
    const config = loadConfig();
    if (provider === "none") {
      config.llm.fallbackProvider = null;
      saveConfig(config);
      console.log("Fallback provider cleared.");
      return;
    }
    if (!VALID_PROVIDERS.includes(provider)) {
      console.error(`Invalid provider "${provider}". Choose from: ${VALID_PROVIDERS.join(", ")}`);
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }
    config.llm.fallbackProvider = provider as LlmProviderName;
    saveConfig(config);
    console.log(`Fallback LLM provider set to: ${provider}`);
  });

// Set API key for a provider
export const configLlmKeyCommand = new Command("config:llm:key")
  .description("Set an API key for an LLM provider")
  .argument("<provider>", "Provider name (gemini, claude, openai)")
  .argument("<key>", "API key value")
  .action(async (provider: string, key: string) => {
    const config = loadConfig();
    const keyMap: Record<string, "geminiApiKey" | "anthropicApiKey" | "openaiApiKey"> = {
      gemini: "geminiApiKey",
      claude: "anthropicApiKey",
      openai: "openaiApiKey",
    };

    const configKey = keyMap[provider];
    if (!configKey) {
      console.error(`No API key for "${provider}". Choose from: ${Object.keys(keyMap).join(", ")}`);
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    config.llm[configKey] = key;
    saveConfig(config);
    console.log(`API key set for ${provider}.`);
  });

// Set model for a provider
export const configLlmModelCommand = new Command("config:llm:model")
  .description("Set the model for an LLM provider")
  .argument("<provider>", "Provider name (ollama, gemini, claude, openai)")
  .argument("<model>", "Model name")
  .action(async (provider: string, model: string) => {
    const config = loadConfig();
    const modelMap: Record<string, "ollamaModel" | "geminiModel" | "anthropicModel" | "claudeCliModel" | "openaiModel"> = {
      ollama: "ollamaModel",
      gemini: "geminiModel",
      claude: "anthropicModel",
      openai: "openaiModel",
    };

    const configKey = modelMap[provider];
    if (!configKey) {
      console.error(`Unknown provider "${provider}". Choose from: ${Object.keys(modelMap).join(", ")}`);
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    config.llm[configKey] = model;
    // If setting claude model, also update CLI model
    if (provider === "claude") {
      config.llm.claudeCliModel = model;
    }
    saveConfig(config);
    console.log(`Model for ${provider} set to: ${model}`);
  });

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];

  // Try to preserve types
  const existing = current[lastKey];
  if (typeof existing === "number") {
    current[lastKey] = Number(value);
  } else if (typeof existing === "boolean") {
    current[lastKey] = value === "true";
  } else {
    current[lastKey] = value;
  }
}
