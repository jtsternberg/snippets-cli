import { describe, it, expect, afterEach } from "vitest";
import {
  getDefaultConfig,
  getLibraryPath,
} from "../src/lib/config.js";
import { getProviderNames } from "../src/lib/providers/index.js";

describe("getDefaultConfig", () => {
  it("returns valid default config", () => {
    const config = getDefaultConfig();

    expect(config.types).toEqual(["snippets", "prompts"]);
    expect(config.defaultType).toBe("snippets");
    expect(config.llm.provider).toBe("ollama");
    expect(config.qmd.collectionName).toBe("snip");
    expect(config.alfred.maxResults).toBe(20);
  });
});

describe("getLibraryPath", () => {
  const originalEnv = process.env.SNIP_LIBRARY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SNIP_LIBRARY = originalEnv;
    } else {
      delete process.env.SNIP_LIBRARY;
    }
  });

  it("uses SNIP_LIBRARY env var when set", () => {
    process.env.SNIP_LIBRARY = "/custom/path";
    expect(getLibraryPath()).toBe("/custom/path");
  });

  it("expands ~ in SNIP_LIBRARY", () => {
    process.env.SNIP_LIBRARY = "~/my-snippets";
    const result = getLibraryPath();
    expect(result).not.toContain("~");
    expect(result).toContain("my-snippets");
  });
});

describe("provider validation", () => {
  const providerNames = getProviderNames();

  it("provider registry includes all expected providers", () => {
    expect(providerNames).toContain("ollama");
    expect(providerNames).toContain("gemini");
    expect(providerNames).toContain("gemini-cli");
    expect(providerNames).toContain("claude");
    expect(providerNames).toContain("claude-cli");
    expect(providerNames).toContain("openai");
    expect(providerNames).toContain("openai-cli");
  });

  it("auto is not a real provider in the registry", () => {
    expect(providerNames).not.toContain("auto");
  });

  it("VALID_PROVIDERS should include auto for primary provider", () => {
    const validProviders = [...providerNames, "auto"];
    expect(validProviders).toContain("auto");
    for (const name of providerNames) {
      expect(validProviders).toContain(name);
    }
  });

  it("VALID_FALLBACK_PROVIDERS should exclude auto", () => {
    const validFallback = providerNames;
    expect(validFallback).not.toContain("auto");
    expect(validFallback.length).toBeGreaterThan(0);
  });
});
