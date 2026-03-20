import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const snipBin = resolve(process.cwd(), "dist/index.js");

function makeConfig(libDir: string) {
  return JSON.stringify({
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
  });
}

function snipDoctor(testDir: string, libDir: string, extraArgs: string[] = []): string {
  return execFileSync("node", [snipBin, "doctor", ...extraArgs], {
    env: {
      ...process.env,
      SNIP_LIBRARY: libDir,
      HOME: testDir,
      XDG_CONFIG_HOME: resolve(testDir, ".config"),
    },
    encoding: "utf-8",
    timeout: 10000,
  });
}

function setupTestEnv(): { testDir: string; libDir: string; cleanup: () => void } {
  const testDir = mkdtempSync(join(tmpdir(), "snip-doctor-git-"));
  const libDir = resolve(testDir, "snippets");
  const configDir = resolve(testDir, ".config", "snip");

  // Create library dirs
  mkdirSync(resolve(libDir, "snippets"), { recursive: true });
  mkdirSync(resolve(libDir, "prompts"), { recursive: true });

  // Create config
  mkdirSync(configDir, { recursive: true });
  writeFileSync(resolve(configDir, "config.json"), makeConfig(libDir), "utf-8");

  return {
    testDir,
    libDir,
    cleanup: () => rmSync(testDir, { recursive: true, force: true }),
  };
}

describe("doctor — Git section", () => {
  let testDir: string;
  let libDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ testDir, libDir, cleanup } = setupTestEnv());
  });

  afterEach(() => {
    cleanup();
  });

  it("reports 'Repository initialized' when .git exists", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Repository initialized");
  });

  it("warns 'No git repository' when .git missing", () => {
    // No git init — library is just a plain directory
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("No git repository");
  });

  it("reports 'Post-commit hook installed' when hook present and current", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });

    // Install the hook by importing the function — but since this is an
    // integration test, we'll create the hook file directly with the sentinel
    const hooksDir = resolve(libDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    // Read HOOK_VERSION from git.ts to match — use a known sentinel pattern
    writeFileSync(
      resolve(hooksDir, "post-commit"),
      `#!/usr/bin/env bash\n# >>> snip-hook-start >>>\n# Installed by snip v1.4.0\necho "hook"\n# <<< snip-hook-end <<<\n`,
      { mode: 0o755 },
    );

    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Post-commit hook installed");
  });

  it("warns 'Post-commit hook missing' when no snip sentinel found", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    // No hook installed
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Post-commit hook missing");
  });

  it("shows info 'No remote configured' with hint", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("No remote configured");
    expect(output).toContain("git -C");
    expect(output).toContain("remote add origin");
  });

  it("reports 'Remote configured' when remote exists", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    execFileSync("git", ["remote", "add", "origin", "https://example.com/repo.git"], {
      cwd: libDir,
      encoding: "utf-8",
    });
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Remote configured");
    // Should NOT contain the "No remote" warning
    expect(output).not.toContain("No remote configured");
  });

  it("reports 'No pending QMD errors' when status file absent", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("No pending QMD errors");
  });

  it("warns when .snip-qmd-status has content", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    writeFileSync(resolve(libDir, ".snip-qmd-status"), "Error: collection not found", "utf-8");
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Pending QMD errors");
    expect(output).toContain("Error: collection not found");
  });

  it("shows Git: section header", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Git:");
  });

  it("warns when core.hooksPath is set and snip hook is not there", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const customHooksDir = resolve(libDir, "custom-hooks");
    mkdirSync(customHooksDir, { recursive: true });
    execFileSync("git", ["config", "core.hooksPath", customHooksDir], {
      cwd: libDir,
      encoding: "utf-8",
    });

    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("core.hooksPath");
    expect(output).toContain("Post-commit hook missing");
  });

  it("warns when hook is installed but outdated", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const hooksDir = resolve(libDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      resolve(hooksDir, "post-commit"),
      `#!/usr/bin/env bash\n# >>> snip-hook-start >>>\n# Installed by snip v0.0.1\necho "hook"\n# <<< snip-hook-end <<<\n`,
      { mode: 0o755 },
    );

    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("outdated");
    expect(output).toContain("doctor --fix");
  });

  it("--fix updates an outdated hook", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const hooksDir = resolve(libDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      resolve(hooksDir, "post-commit"),
      `#!/usr/bin/env bash\n# >>> snip-hook-start >>>\n# Installed by snip v0.0.1\necho "hook"\n# <<< snip-hook-end <<<\n`,
      { mode: 0o755 },
    );

    const output = snipDoctor(testDir, libDir, ["--fix"]);
    expect(output).toContain("Post-commit hook updated");
  });

  it("--fix initializes git repo when missing", () => {
    // No git init — library is just a plain directory
    const output = snipDoctor(testDir, libDir, ["--fix"]);
    expect(output).toContain("Git repository initialized");
    expect(output).toContain("Post-commit hook installed");
  });

  it("reports hook installed when core.hooksPath has snip hook", () => {
    execFileSync("git", ["init"], { cwd: libDir, encoding: "utf-8" });
    const customHooksDir = resolve(libDir, "custom-hooks");
    mkdirSync(customHooksDir, { recursive: true });
    execFileSync("git", ["config", "core.hooksPath", customHooksDir], {
      cwd: libDir,
      encoding: "utf-8",
    });

    // Install hook in the custom hooks dir
    writeFileSync(
      resolve(customHooksDir, "post-commit"),
      `#!/usr/bin/env bash\n# >>> snip-hook-start >>>\n# Installed by snip v1.4.0\necho "hook"\n# <<< snip-hook-end <<<\n`,
      { mode: 0o755 },
    );

    const output = snipDoctor(testDir, libDir);
    expect(output).toContain("Post-commit hook installed");
  });
});
