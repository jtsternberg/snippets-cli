import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const snipBin = resolve(process.cwd(), "dist/index.js");

// Minimal PATH: node + git but no qmd/ollama, avoids slow external tool checks
const MINIMAL_PATH = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

function snip(args: string[], testDir: string, libDir: string): string {
  return execFileSync("node", [snipBin, ...args], {
    env: {
      ...process.env,
      SNIP_LIBRARY: libDir,
      HOME: testDir,
      XDG_CONFIG_HOME: resolve(testDir, ".config"),
      PATH: MINIMAL_PATH,
      EDITOR: "true", // ensure config stores a fast no-op editor
    },
    encoding: "utf-8",
    timeout: 15000,
  }).trim();
}

function gitLog(cwd: string): string {
  return execFileSync("git", ["log", "--oneline"], { cwd, encoding: "utf-8" }).trim();
}

function gitLogCount(cwd: string): number {
  return parseInt(
    execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd, encoding: "utf-8" }).trim(),
    10,
  );
}

/** Set up a collection via `snip init` (creates .git, config, dirs, initial commit) */
function setupSnipEnv(): { testDir: string; libDir: string } {
  const testDir = mkdtempSync(join(tmpdir(), "snip-commit-window-"));
  const libDir = resolve(testDir, "snippets");
  snip(["init", libDir], testDir, libDir);
  return { testDir, libDir };
}

/** Set up a pre-existing collection manually (no .git) */
function setupManualEnv(): { testDir: string; libDir: string } {
  const testDir = mkdtempSync(join(tmpdir(), "snip-commit-autoinit-"));
  const libDir = resolve(testDir, "snippets");

  mkdirSync(resolve(libDir, "snippets"), { recursive: true });
  mkdirSync(resolve(libDir, "prompts"), { recursive: true });
  mkdirSync(resolve(testDir, ".config", "snip"), { recursive: true });

  writeFileSync(
    resolve(testDir, ".config", "snip", "config.json"),
    JSON.stringify({
      libraryPath: libDir,
      types: ["snippets", "prompts"],
      defaultType: "snippets",
      editor: "cat",
      llm: { provider: "ollama", ollamaModel: "qwen2.5-coder:7b", ollamaHost: "http://localhost:11434", fallbackProvider: null, openaiApiKey: null, anthropicApiKey: null },
      qmd: { collectionName: "snip" },
      alfred: { maxResults: 20 },
    }),
    "utf-8",
  );

  return { testDir, libDir };
}

describe("commit window — postAction creates git commits", () => {
  let testDir: string;
  let libDir: string;

  beforeEach(() => {
    ({ testDir, libDir } = setupSnipEnv());
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("snip add creates exactly 1 new git commit", { timeout: 15000 }, () => {
    const countBefore = gitLogCount(libDir);
    snip(["add", "--title", "Commit Test", "--content", "hello", "--lang", "bash"], testDir, libDir);
    const countAfter = gitLogCount(libDir);
    expect(countAfter).toBe(countBefore + 1);
  });

  it("commit message contains snip: add", { timeout: 15000 }, () => {
    snip(["add", "--title", "Message Test", "--content", "hello", "--lang", "bash"], testDir, libDir);
    const log = gitLog(libDir);
    expect(log).toContain("snip: add");
  });

  it("snip rm creates a git commit", { timeout: 15000 }, () => {
    snip(["add", "--title", "To Delete", "--content", "bye", "--lang", "bash"], testDir, libDir);
    const countBefore = gitLogCount(libDir);
    snip(["rm", "to-delete", "--force"], testDir, libDir);
    const countAfter = gitLogCount(libDir);
    expect(countAfter).toBe(countBefore + 1);
  });

  it("snip rename creates a git commit", { timeout: 15000 }, () => {
    snip(["add", "--title", "To Rename", "--content", "hi", "--lang", "bash"], testDir, libDir);
    const countBefore = gitLogCount(libDir);
    snip(["rename", "to-rename", "Renamed Thing"], testDir, libDir);
    const countAfter = gitLogCount(libDir);
    expect(countAfter).toBe(countBefore + 1);
  });
});

describe("commit window — auto-init on pre-existing collection", () => {
  let testDir: string;
  let libDir: string;

  beforeEach(() => {
    ({ testDir, libDir } = setupManualEnv());
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("auto-initializes git on first snip command", { timeout: 15000 }, () => {
    expect(existsSync(join(libDir, ".git"))).toBe(false);
    snip(["add", "--title", "Auto Init", "--content", "test", "--lang", "bash"], testDir, libDir);
    expect(existsSync(join(libDir, ".git"))).toBe(true);
  });
});

describe("commit window — QMD error surfacing", () => {
  let testDir: string;
  let libDir: string;

  beforeEach(() => {
    ({ testDir, libDir } = setupSnipEnv());
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("clears .snip-qmd-status on next command", { timeout: 15000 }, () => {
    writeFileSync(join(libDir, ".snip-qmd-status"), "qmd: collection not found", "utf-8");
    snip(["list"], testDir, libDir);
    expect(existsSync(join(libDir, ".snip-qmd-status"))).toBe(false);
  });
});
