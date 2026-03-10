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
      fallbackProvider: null,
      ollamaModel: "qwen2.5-coder:7b",
      ollamaHost: "http://localhost:11434",
      geminiApiKey: null,
      geminiModel: "gemini-2.5-flash",
      geminiCliModel: "gemini-2.5-flash",
      anthropicApiKey: null,
      anthropicModel: "claude-3-5-haiku-latest",
      claudeCliModel: "claude-3-5-haiku-latest",
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

export function updateConfig(
  updates: Partial<SnipConfig> & Record<string, unknown>,
): SnipConfig {
  const current = loadConfig();
  const updated = { ...current, ...updates };
  saveConfig(updated as SnipConfig);
  return updated as SnipConfig;
}
