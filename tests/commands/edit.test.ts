import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const snipBin = resolve(process.cwd(), "dist/index.js");

// Minimal PATH: node + git but no qmd/ollama
const MINIMAL_PATH = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

function snip(args: string[], testDir: string, libDir: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync("node", [snipBin, ...args], {
    env: {
      ...process.env,
      SNIP_LIBRARY: libDir,
      HOME: testDir,
      XDG_CONFIG_HOME: resolve(testDir, ".config"),
      PATH: MINIMAL_PATH,
      EDITOR: "true", // default no-op editor (overridable via extraEnv)
      ...extraEnv,
    },
    encoding: "utf-8",
    timeout: 15000,
  }).trim();
}

function setupSnipEnv(): { testDir: string; libDir: string } {
  const testDir = mkdtempSync(join(tmpdir(), "snip-edit-test-"));
  const libDir = resolve(testDir, "snippets");
  snip(["init", libDir], testDir, libDir);

  // Patch config to clear editor so EDITOR env var is used at runtime
  const configPath = resolve(testDir, ".config", "snip", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  config.editor = "";
  writeFileSync(configPath, JSON.stringify(config), "utf-8");

  return { testDir, libDir };
}

function gitLogCount(cwd: string): number {
  return parseInt(
    execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd, encoding: "utf-8" }).trim(),
    10,
  );
}

describe("edit — phantom commit prevention", () => {
  let testDir: string;
  let libDir: string;

  beforeEach(() => {
    ({ testDir, libDir } = setupSnipEnv());
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("no-op edit does not create a git commit", { timeout: 15000 }, () => {
    snip(["add", "--title", "Phantom Test", "--content", "unchanged", "--lang", "bash"], testDir, libDir);
    const countBefore = gitLogCount(libDir);

    // EDITOR=true exits 0 without modifying the file
    snip(["edit", "phantom-test"], testDir, libDir);

    const countAfter = gitLogCount(libDir);
    expect(countAfter).toBe(countBefore);
  });

  it("no-op edit preserves original modified date", { timeout: 15000 }, () => {
    snip(["add", "--title", "Date Test", "--content", "keep date", "--lang", "bash"], testDir, libDir);

    // Read the file to get original modified date
    const snippetPath = resolve(libDir, "snippets", "date-test.md");
    const contentBefore = readFileSync(snippetPath, "utf-8");
    const modifiedBefore = contentBefore.match(/modified: (.+)/)?.[1];

    snip(["edit", "date-test"], testDir, libDir);

    const contentAfter = readFileSync(snippetPath, "utf-8");
    const modifiedAfter = contentAfter.match(/modified: (.+)/)?.[1];
    expect(modifiedAfter).toBe(modifiedBefore);
  });

  it("actual edit creates a git commit", { timeout: 15000 }, () => {
    snip(["add", "--title", "Real Edit", "--content", "original", "--lang", "bash"], testDir, libDir);
    const countBefore = gitLogCount(libDir);

    // Write a tiny editor script that modifies the file
    const editorScript = join(testDir, "edit.sh");
    writeFileSync(editorScript, '#!/bin/sh\necho "modified content" >> "$1"\n', { mode: 0o755 });
    snip(["edit", "real-edit"], testDir, libDir, { EDITOR: editorScript });

    const countAfter = gitLogCount(libDir);
    expect(countAfter).toBe(countBefore + 1);
  });
});
