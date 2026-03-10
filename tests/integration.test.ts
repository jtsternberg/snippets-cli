import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const testDir = resolve(tmpdir(), `snip-integration-${Date.now()}`);
const configDir = resolve(testDir, ".config", "snip");
const libDir = resolve(testDir, "snippets");
const snipBin = resolve(process.cwd(), "dist/index.js");

function snip(args: string[], opts: { input?: string } = {}): string {
  return execFileSync("node", [snipBin, ...args], {
    env: {
      ...process.env,
      SNIP_LIBRARY: libDir,
      HOME: testDir,
      XDG_CONFIG_HOME: resolve(testDir, ".config"),
    },
    input: opts.input,
    encoding: "utf-8",
    timeout: 10000,
  }).trim();
}

beforeAll(() => {
  // Create library dirs and config
  mkdirSync(resolve(libDir, "snippets"), { recursive: true });
  mkdirSync(resolve(libDir, "prompts"), { recursive: true });
  mkdirSync(configDir, { recursive: true });

  writeFileSync(
    resolve(configDir, "config.json"),
    JSON.stringify({
      libraryPath: libDir,
      types: ["snippets", "prompts"],
      defaultType: "snippets",
      editor: "cat",
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
    }),
    "utf-8",
  );

  // Build before tests (in case dist is stale)
  execFileSync("npm", ["run", "build"], { cwd: process.cwd(), encoding: "utf-8" });
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("snip add (non-interactive)", () => {
  it("creates a snippet from --content", { timeout: 30000 }, () => {
    const output = snip([
      "add",
      "--title", "Test Snippet",
      "--lang", "bash",
      "--tags", "test,integration",
      "--content", "echo hello world",
    ]);

    expect(output).toContain("Created:");
    expect(output).toContain("test-snippet");

    const filePath = resolve(libDir, "snippets", "test-snippet.md");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("title: Test Snippet");
    expect(content).toContain("language: bash");
    expect(content).toContain("echo hello world");
  });
});

describe("snip list", () => {
  it("lists created snippets", () => {
    const output = snip(["list"]);
    expect(output).toContain("test-snippet");
    expect(output).toContain("Test Snippet");
  });

  it("supports --json output", () => {
    const output = snip(["list", "--json"]);
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((s: { slug: string }) => s.slug === "test-snippet")).toBe(true);
  });

  it("filters by tag", () => {
    const output = snip(["list", "--tag", "integration"]);
    expect(output).toContain("test-snippet");
  });

  it("filters by language", () => {
    const output = snip(["list", "--lang", "bash"]);
    expect(output).toContain("test-snippet");
  });

  it("returns empty for non-matching filter", () => {
    const output = snip(["list", "--lang", "rust"]);
    expect(output).toContain("0 snippet(s)");
  });
});

describe("snip show", () => {
  it("displays snippet content", () => {
    const output = snip(["show", "test-snippet"]);
    expect(output).toContain("Test Snippet");
    expect(output).toContain("echo hello world");
  });

  it("supports --raw flag", () => {
    const output = snip(["show", "test-snippet", "--raw"]);
    expect(output).toContain("---");
    expect(output).toContain("title: Test Snippet");
  });

  it("supports --code flag", () => {
    const output = snip(["show", "test-snippet", "--code"]);
    expect(output).toContain("echo hello world");
    expect(output).not.toContain("title:");
  });

  it("exits with error for nonexistent snippet", () => {
    expect(() => snip(["show", "nonexistent"])).toThrow();
  });
});

describe("snip find", () => {
  it("finds snippets by text search", () => {
    const output = snip(["find", "hello"]);
    expect(output).toContain("test-snippet");
  });

  it("finds by tag name", () => {
    const output = snip(["find", "integration"]);
    expect(output).toContain("test-snippet");
  });

  it("returns no results for unmatched query", () => {
    const output = snip(["find", "zzzznonexistentzzzz"]);
    expect(output).toContain("No results");
  });

  it("supports --json output", () => {
    const output = snip(["find", "hello", "--json"]);
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe("snip tags", () => {
  it("lists all tags with counts", () => {
    const output = snip(["tags"]);
    expect(output).toContain("test");
    expect(output).toContain("integration");
  });

  it("supports --json output", () => {
    const output = snip(["tags", "--json"]);
    const data = JSON.parse(output);
    expect(data.test).toBe(1);
    expect(data.integration).toBe(1);
  });
});

describe("snip doctor", () => {
  it("runs health check without errors", () => {
    const output = snip(["doctor"]);
    expect(output).toContain("Config:");
    expect(output).toContain("Library:");
    expect(output).toContain("Snippets:");
  });
});

describe("snip rename", () => {
  it("renames a snippet", () => {
    const output = snip(["rename", "test-snippet", "Renamed Snippet"]);
    expect(output).toContain("renamed-snippet");

    expect(existsSync(resolve(libDir, "snippets", "renamed-snippet.md"))).toBe(true);
    expect(existsSync(resolve(libDir, "snippets", "test-snippet.md"))).toBe(false);

    const listOutput = snip(["list"]);
    expect(listOutput).toContain("renamed-snippet");
  });
});

describe("snip rm", () => {
  it("removes a snippet", () => {
    const output = snip(["rm", "renamed-snippet", "--force"]);
    expect(output).toContain("Deleted:");

    expect(existsSync(resolve(libDir, "snippets", "renamed-snippet.md"))).toBe(false);

    const listOutput = snip(["list"]);
    expect(listOutput).toContain("No snippets found");
  });
});
