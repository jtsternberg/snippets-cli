import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseGistId } from "../src/lib/gist.js";

// ---------------------------------------------------------------------------
// Unit tests for gist URL/ID parsing
// ---------------------------------------------------------------------------
describe("parseGistId", () => {
  it("extracts ID from full gist URL with user", () => {
    expect(parseGistId("https://gist.github.com/user/abc123def456")).toBe(
      "abc123def456",
    );
  });

  it("extracts ID from gist URL without user", () => {
    expect(parseGistId("https://gist.github.com/abc123def456")).toBe(
      "abc123def456",
    );
  });

  it("returns bare hex ID as-is", () => {
    expect(parseGistId("abc123def456")).toBe("abc123def456");
  });

  it("handles URL with trailing path or query", () => {
    expect(
      parseGistId("https://gist.github.com/user/abc123def456/raw"),
    ).toBe("abc123def456");
  });
});

// ---------------------------------------------------------------------------
// Integration tests for gist export/import
// ---------------------------------------------------------------------------
const testDir = resolve(tmpdir(), `snip-gist-test-${Date.now()}`);
const configDir = resolve(testDir, ".config", "snip");
const libDir = resolve(testDir, "snippets");
const snipBin = resolve(process.cwd(), "dist/index.js");

// Preserve real GH config so gh auth works in test env
const realHome = process.env.HOME || "";
const ghConfigDir = process.env.GH_CONFIG_DIR || resolve(realHome, ".config", "gh");

const testEnv = {
  ...process.env,
  SNIP_LIBRARY: libDir,
  HOME: testDir,
  XDG_CONFIG_HOME: resolve(testDir, ".config"),
  GH_CONFIG_DIR: ghConfigDir,
};

function snip(args: string[]): string {
  return execFileSync("node", [snipBin, ...args], {
    env: testEnv,
    encoding: "utf-8",
    timeout: 15000,
  }).trim();
}

function snipErr(args: string[]): string {
  try {
    execFileSync("node", [snipBin, ...args], {
      env: testEnv,
      encoding: "utf-8",
      timeout: 15000,
    });
    return "";
  } catch (err: unknown) {
    return (err as { stderr?: string }).stderr || "";
  }
}

function gistSnippetPath(): string {
  return resolve(libDir, "snippets", "gist-test-snippet.md");
}

function readGistSnippet(): string {
  return readFileSync(gistSnippetPath(), "utf-8");
}

function readStoredGistId(): string | null {
  const match = readGistSnippet().match(/gist_id:\s*(\S+)/);
  return match ? match[1] : null;
}

// Check gh availability synchronously at module load so it.skipIf works correctly
let ghAvailable = false;
try {
  execFileSync("gh", ["auth", "status"], {
    env: testEnv,
    stdio: "pipe",
  });
  ghAvailable = true;
} catch {
  ghAvailable = false;
}

beforeAll(() => {
  execFileSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    encoding: "utf-8",
  });

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

  // Create a test snippet
  snip([
    "add",
    "--title", "Gist Test Snippet",
    "--lang", "bash",
    "--tags", "test,gist",
    "--content", "echo 'hello from gist test'",
  ]);
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("snip export --to-gist", () => {
  it("shows error when snippet not found", () => {
    const err = snipErr(["export", "nonexistent", "--to-gist"]);
    expect(err).toContain("not found");
  });

  it.skipIf(!ghAvailable)("creates a gist and saves gist_id to frontmatter", { timeout: 30000 }, () => {
    const output = snip(["export", "gist-test-snippet", "--to-gist"]);
    expect(output).toContain("Created gist:");
    expect(output).toContain("gist.github.com");
    expect(output).toContain("Saved gist_id");

    // Verify gist_id was saved to frontmatter
    const content = readGistSnippet();
    expect(content).toContain("gist_id:");
  });

  it.skipIf(!ghAvailable)("updates existing gist on re-export", { timeout: 30000 }, () => {
    expect(readStoredGistId()).toBeTruthy();

    const output = snip(["export", "gist-test-snippet", "--to-gist"]);
    expect(output).toContain("Updated gist:");
  });
});

describe("snip sync", () => {
  it("rejects --push with --pull", () => {
    const err = snipErr(["sync", "--push", "--pull"]);
    expect(err).toContain("Cannot use --push and --pull together.");
  });

  it("reports no linked snippets when none have gist_id", () => {
    const originalContent = readGistSnippet();
    const strippedContent = originalContent
      .replace(/^gist_id:.*\n?/m, "")
      .replace(/^gist_updated:.*\n?/m, "");

    writeFileSync(gistSnippetPath(), strippedContent, "utf-8");

    try {
      snip([
        "add",
        "--title", "No Gist Snippet",
        "--lang", "bash",
        "--content", "echo no gist",
      ]);

      const output = snip(["sync"]);
      expect(output).toContain("No snippets linked to gists");

      snip(["rm", "no-gist-snippet", "--force"]);
    } finally {
      writeFileSync(gistSnippetPath(), originalContent, "utf-8");
    }
  });

  it.skipIf(!ghAvailable)("supports --dry-run flag", { timeout: 30000 }, () => {
    // This test only runs if there are gist-linked snippets
    const output = snip(["sync", "--dry-run"]);
    expect(output).toMatch(/Dry run:|No snippets linked/);
  });
});

describe("snip import --from-gist", () => {
  it("requires --from-gist value", () => {
    const err = snipErr(["import"]);
    expect(err).toContain("No sources specified");
  });

  it("rejects positional sources together with --from-gist", () => {
    const err = snipErr(["import", "README.md", "--from-gist", "abc123def456"]);
    expect(err).toContain("Cannot use positional sources together with --from-gist.");
  });

  it.skipIf(!ghAvailable)("imports files from a gist", { timeout: 30000 }, () => {
    // First export to get a gist URL
    const gistId = readStoredGistId();
    expect(gistId).toBeTruthy();

    // Remove the snippet first so we can re-import
    snip(["rm", "gist-test-snippet", "--force"]);

    const output = snip([
      "import",
      "--from-gist", gistId!,
      "--no-enrich",
    ]);
    expect(output).toContain("Imported:");
    expect(output).toContain("imported from gist");
  });
});
