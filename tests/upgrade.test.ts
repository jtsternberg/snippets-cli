import { describe, it, expect } from "vitest";
import { findMissingKeys } from "../src/commands/upgrade.js";

describe("findMissingKeys", () => {
  it("detects missing top-level keys", () => {
    const saved = { a: 1, b: 2 };
    const defaults = { a: 1, b: 2, c: 3 };
    expect(findMissingKeys(saved, defaults)).toEqual(["c"]);
  });

  it("returns empty array when saved matches defaults", () => {
    const saved = { a: 1, b: 2 };
    const defaults = { a: 1, b: 2 };
    expect(findMissingKeys(saved, defaults)).toEqual([]);
  });

  it("returns empty array when saved has extra keys", () => {
    const saved = { a: 1, b: 2, extra: "ok" };
    const defaults = { a: 1, b: 2 };
    expect(findMissingKeys(saved, defaults)).toEqual([]);
  });

  it("detects missing nested keys with dot-notation paths", () => {
    const saved = { llm: { provider: "ollama" } };
    const defaults = { llm: { provider: "ollama", newSetting: true } };
    expect(findMissingKeys(saved, defaults)).toEqual(["llm.newSetting"]);
  });

  it("detects deeply nested missing keys", () => {
    const saved = { a: { b: { c: 1 } } };
    const defaults = { a: { b: { c: 1, d: 2 } } };
    expect(findMissingKeys(saved, defaults)).toEqual(["a.b.d"]);
  });

  it("reports entire missing nested object as single key", () => {
    const saved = { a: 1 };
    const defaults = { a: 1, nested: { x: 1, y: 2 } };
    expect(findMissingKeys(saved, defaults)).toEqual(["nested"]);
  });

  it("handles mix of top-level and nested missing keys", () => {
    const saved = {
      libraryPath: "/home/user/snippets",
      llm: { provider: "ollama", ollamaModel: "qwen2.5-coder:7b" },
    };
    const defaults = {
      libraryPath: "/home/user/snippets",
      newTopLevel: "value",
      llm: { provider: "ollama", ollamaModel: "qwen2.5-coder:7b", newNested: "value" },
    };
    expect(findMissingKeys(saved, defaults)).toEqual([
      "newTopLevel",
      "llm.newNested",
    ]);
  });

  it("does not recurse into arrays", () => {
    const saved = { types: ["snippets"] };
    const defaults = { types: ["snippets", "prompts"] };
    // Arrays are values, not objects to recurse into — no missing keys
    expect(findMissingKeys(saved, defaults)).toEqual([]);
  });

  it("does not recurse when saved value is non-object", () => {
    const saved = { llm: "flat-string" };
    const defaults = { llm: { provider: "ollama" } };
    // saved.llm is a string, not an object — can't recurse, not "missing"
    expect(findMissingKeys(saved, defaults)).toEqual([]);
  });

  it("handles real SnipConfig shape", () => {
    const saved = {
      libraryPath: "/home/user/snippets",
      types: ["snippets", "prompts"],
      defaultType: "snippets",
      editor: "vi",
      llm: {
        provider: "ollama",
        ollamaModel: "qwen2.5-coder:7b",
        ollamaHost: "http://localhost:11434",
        fallbackProvider: null,
        openaiApiKey: null,
        anthropicApiKey: null,
      },
      qmd: { collectionName: "snip" },
      // alfred section missing entirely
    };
    const defaults = {
      libraryPath: "/home/user/snippets",
      types: ["snippets", "prompts"],
      defaultType: "snippets",
      editor: "vi",
      llm: {
        provider: "ollama",
        ollamaModel: "qwen2.5-coder:7b",
        ollamaHost: "http://localhost:11434",
        fallbackProvider: null,
        openaiApiKey: null,
        anthropicApiKey: null,
      },
      qmd: { collectionName: "snip" },
      alfred: { maxResults: 20 },
    };
    expect(findMissingKeys(saved, defaults)).toEqual(["alfred"]);
  });
});
