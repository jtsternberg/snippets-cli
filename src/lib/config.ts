import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { SnipConfig } from "../types/index.js";

function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || resolve(homedir(), ".config");
  return resolve(base, "snip");
}


export function getDefaultConfig(): SnipConfig {
  return {
    libraryPath: resolve(homedir(), "snippets"),
    types: ["snippets", "prompts"],
    defaultType: "snippets",
    editor: process.env.EDITOR || "vi",
    llm: {
      provider: "ollama",
      fallbackProvider: null,
      ollamaModel: "qwen2.5-coder:7b",
      ollamaHost: "http://localhost:11434",
      geminiApiKey: null,
      geminiModel: "gemini-2.5-flash",
      geminiCliModel: "gemini-2.5-flash",
      anthropicApiKey: null,
      anthropicModel: "claude-3-5-haiku-latest",
      claudeCliModel: "haiku",
      openaiApiKey: null,
      openaiModel: "gpt-4o-mini",
      codexCliModel: "o4-mini",
    },
    qmd: {
      collectionName: "snip",
    },
    alfred: {
      maxResults: 20,
    },
  };
}

export function getConfigPath(): string {
  return resolve(getConfigDir(), "config.json");
}

export function configExists(): boolean {
  return existsSync(getConfigPath());
}

export function loadConfig(): SnipConfig {
  const defaults = getDefaultConfig();

  if (!configExists()) {
    return defaults;
  }

  const raw = readFileSync(getConfigPath(), "utf-8");
  const parsed = JSON.parse(raw) as Partial<SnipConfig>;

  return {
    ...defaults,
    ...parsed,
    llm: { ...defaults.llm, ...(parsed.llm || {}) },
    qmd: { ...defaults.qmd, ...(parsed.qmd || {}) },
    alfred: { ...defaults.alfred, ...(parsed.alfred || {}) },
  };
}

export function saveConfig(config: SnipConfig): void {
  mkdirSync(getConfigDir(), { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function getLibraryPath(config?: SnipConfig): string {
  const envOverride = process.env.SNIP_LIBRARY;
  if (envOverride) {
    return resolve(envOverride.replace(/^~/, homedir()));
  }

  const cfg = config || loadConfig();
  return resolve(cfg.libraryPath.replace(/^~/, homedir()));
}

export function getConfigKeys(): string[] {
  const keys: string[] = [];
  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        keys.push(path);
        walk(val as Record<string, unknown>, path);
      } else {
        keys.push(path);
      }
    }
  }
  walk(getDefaultConfig() as unknown as Record<string, unknown>, "");
  return keys;
}

export function assertLibraryExists(libPath: string): void {
  if (!existsSync(libPath)) {
    console.error(
      `Snippet library not found at: ${libPath}\n` +
      `\n` +
      `If this path is wrong, update it:\n` +
      `  snip config libraryPath ~/snippets\n` +
      `\n` +
      `If the library has never been initialized, create it:\n` +
      `  snip init`
    );
    process.exit(3); // EXIT_CODES.CONFIG_ERROR
  }
}

export function validateType(type: string, config?: SnipConfig): void {
  const cfg = config || loadConfig();
  if (!cfg.types.includes(type)) {
    const available = cfg.types.join(", ");
    console.error(
      `Type "${type}" is not registered. Available types: ${available}\n` +
      `Run \`snip config:types:add ${type}\` to register it.`
    );
    process.exit(3); // EXIT_CODES.CONFIG_ERROR
  }
}

export function updateConfig(
  updates: Partial<SnipConfig> & Record<string, unknown>,
): SnipConfig {
  const current = loadConfig();
  const updated = { ...current, ...updates };
  saveConfig(updated as SnipConfig);
  return updated as SnipConfig;
}
