import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const snipBin = resolve(process.cwd(), "dist/index.js");

// Minimal PATH with node + git but no qmd, so ensureQmd() returns false.
const PATH_WITHOUT_QMD = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

function snip(args: string[], testDir: string, libDir: string): string {
  return execFileSync("node", [snipBin, ...args], {
    env: {
      ...process.env,
      SNIP_LIBRARY: libDir,
      HOME: testDir,
      XDG_CONFIG_HOME: resolve(testDir, ".config"),
      PATH: PATH_WITHOUT_QMD,
    },
    encoding: "utf-8",
    timeout: 15000,
  }).trim();
}

describe("snip init — git integration", () => {
  let testDir: string;
  let libDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "snip-init-git-"));
    libDir = resolve(testDir, "my-snippets");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates .git in library directory", { timeout: 15000 }, () => {
    snip(["init", libDir], testDir, libDir);
    expect(existsSync(join(libDir, ".git"))).toBe(true);
  });

  it("installs post-commit hook with snip-hook-start sentinel", { timeout: 15000 }, () => {
    snip(["init", libDir], testDir, libDir);
    const hookPath = join(libDir, ".git", "hooks", "post-commit");
    expect(existsSync(hookPath)).toBe(true);
    const hookContent = readFileSync(hookPath, "utf-8");
    expect(hookContent).toContain("snip-hook-start");
  });

  it("creates initial commit with message containing 'snip: initialize collection'", { timeout: 15000 }, () => {
    snip(["init", libDir], testDir, libDir);
    const log = execFileSync("git", ["log", "--oneline"], {
      cwd: libDir,
      encoding: "utf-8",
    }).trim();
    expect(log).toContain("snip: initialize collection");
  });

  it(".gitignore includes .snip-qmd-status", { timeout: 15000 }, () => {
    snip(["init", libDir], testDir, libDir);
    const gitignore = readFileSync(join(libDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".snip-qmd-status");
  });

  it("git log shows exactly 1 commit after init", { timeout: 15000 }, () => {
    snip(["init", libDir], testDir, libDir);
    const count = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd: libDir,
      encoding: "utf-8",
    }).trim();
    expect(count).toBe("1");
  });
});
