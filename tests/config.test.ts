import { describe, it, expect, afterEach } from "vitest";
import {
  getDefaultConfig,
  getLibraryPath,
} from "../src/lib/config.js";

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
