import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { SnipConfig } from "../types/index.js";

const CONFIG_DIR = resolve(homedir(), ".config", "snip");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

export function getDefaultConfig(): SnipConfig {
  return {
    libraryPath: resolve(homedir(), "snippets"),
    types: ["snippets", "prompts"],
    defaultType: "snippets",
    editor: process.env.EDITOR || "vi",
    llm: {
      provider: "ollama",
      ollamaModel: "llama3.1",
      ollamaHost: "http://localhost:11434",
      fallbackProvider: null,
      openaiApiKey: null,
      anthropicApiKey: null,
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
  return CONFIG_PATH;
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function loadConfig(): SnipConfig {
  const defaults = getDefaultConfig();

  if (!configExists()) {
    return defaults;
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
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
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function getLibraryPath(config?: SnipConfig): string {
  const envOverride = process.env.SNIP_LIBRARY;
  if (envOverride) {
    return resolve(envOverride.replace(/^~/, homedir()));
  }

  const cfg = config || loadConfig();
  return resolve(cfg.libraryPath.replace(/^~/, homedir()));
}

export function updateConfig(
  updates: Partial<SnipConfig> & Record<string, unknown>,
): SnipConfig {
  const current = loadConfig();
  const updated = { ...current, ...updates };
  saveConfig(updated as SnipConfig);
  return updated as SnipConfig;
}
