import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import {
  isGitRepo,
  initGitRepo,
  commitAll,
  hasChanges,
  hasRemote,
  isGitInstalled,
  installPostCommitHook,
  isHookInstalled,
  hasExistingHook,
  HOOK_VERSION,
} from "../../src/lib/git.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "snip-git-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

/** Helper: run git in tempDir */
function git(...args: string[]) {
  return execFileSync("git", args, { cwd: tempDir, encoding: "utf8" });
}

/** Helper: init a git repo with an initial commit */
function initRepoWithCommit() {
  git("init");
  git("config", "user.email", "test@test.com");
  git("config", "user.name", "Test");
  writeFileSync(join(tempDir, "README.md"), "hello");
  git("add", ".");
  git("commit", "-m", "initial commit");
}

describe("isGitInstalled", () => {
  it("returns true when git is available", () => {
    expect(isGitInstalled()).toBe(true);
  });
});

describe("isGitRepo", () => {
  it("returns false for a plain directory", () => {
    expect(isGitRepo(tempDir)).toBe(false);
  });

  it("returns true after git init", () => {
    git("init");
    expect(isGitRepo(tempDir)).toBe(true);
  });
});

describe("initGitRepo", () => {
  it("creates .git dir and returns true on first call", () => {
    const result = initGitRepo(tempDir);
    expect(result).toBe(true);
    expect(statSync(join(tempDir, ".git")).isDirectory()).toBe(true);
  });

  it("returns false (no-op) when .git already exists", () => {
    git("init");
    const result = initGitRepo(tempDir);
    expect(result).toBe(false);
  });

  it("does NOT create a new commit on a repo with existing commits", () => {
    initRepoWithCommit();
    const logBefore = git("log", "--oneline");
    const commitCountBefore = logBefore.trim().split("\n").length;

    initGitRepo(tempDir);

    const logAfter = git("log", "--oneline");
    const commitCountAfter = logAfter.trim().split("\n").length;
    expect(commitCountAfter).toBe(commitCountBefore);
  });
});

describe("hasChanges", () => {
  it("detects new files", () => {
    git("init");
    writeFileSync(join(tempDir, "new.txt"), "content");
    expect(hasChanges(tempDir)).toBe(true);
  });

  it("detects modified files", () => {
    initRepoWithCommit();
    writeFileSync(join(tempDir, "README.md"), "modified");
    expect(hasChanges(tempDir)).toBe(true);
  });

  it("detects deleted files", () => {
    initRepoWithCommit();
    unlinkSync(join(tempDir, "README.md"));
    expect(hasChanges(tempDir)).toBe(true);
  });

  it("returns false when working tree is clean", () => {
    initRepoWithCommit();
    expect(hasChanges(tempDir)).toBe(false);
  });
});

describe("commitAll", () => {
  it("stages and commits all changes with the given message", () => {
    initRepoWithCommit();
    writeFileSync(join(tempDir, "file.txt"), "new content");

    commitAll(tempDir, "test commit message");

    const log = git("log", "--oneline", "-1");
    expect(log).toContain("test commit message");
  });

  it("is a no-op when there are no changes", () => {
    initRepoWithCommit();
    const logBefore = git("log", "--oneline");

    commitAll(tempDir, "should not appear");

    const logAfter = git("log", "--oneline");
    expect(logAfter).toBe(logBefore);
  });
});

describe("hasRemote", () => {
  it("returns false with no remote configured", () => {
    git("init");
    expect(hasRemote(tempDir)).toBe(false);
  });

  it("returns true after adding a remote", () => {
    git("init");
    git("remote", "add", "origin", "https://example.com/repo.git");
    expect(hasRemote(tempDir)).toBe(true);
  });
});

describe("installPostCommitHook — fresh repo", () => {
  beforeEach(() => {
    initRepoWithCommit();
  });

  it("creates .git/hooks/post-commit with shebang and snip section", () => {
    installPostCommitHook(tempDir);

    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toMatch(/^#!\/usr\/bin\/env bash\n/);
    expect(content).toContain("# >>> snip-hook-start >>>");
    expect(content).toContain("# <<< snip-hook-end <<<");
    expect(content).toContain("qmd update");
    expect(content).toContain("qmd embed");
  });

  it("sets the executable bit on the hook file", () => {
    installPostCommitHook(tempDir);

    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    const mode = statSync(hookPath).mode;
    expect(mode & 0o111).toBeTruthy();
  });

  it("marks hook as installed via isHookInstalled", () => {
    installPostCommitHook(tempDir);
    expect(isHookInstalled(tempDir)).toBe(true);
  });
});

describe("installPostCommitHook — pre-existing hook", () => {
  const existingContent = '#!/bin/bash\necho "existing hook"\n';

  beforeEach(() => {
    initRepoWithCommit();
    const hooksDir = join(tempDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "post-commit"), existingContent, { mode: 0o755 });
  });

  it("appends snip section to existing hook content", () => {
    installPostCommitHook(tempDir);

    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("# >>> snip-hook-start >>>");
    expect(content).toContain('echo "existing hook"');
  });

  it("preserves existing hook content above snip section", () => {
    installPostCommitHook(tempDir);

    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    const content = readFileSync(hookPath, "utf8");

    const snipStart = content.indexOf("# >>> snip-hook-start >>>");
    const existingPos = content.indexOf('echo "existing hook"');
    expect(existingPos).toBeLessThan(snipStart);
  });

  it("does NOT duplicate the shebang", () => {
    installPostCommitHook(tempDir);

    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    const content = readFileSync(hookPath, "utf8");

    const shebangCount = (content.match(/^#!.*/gm) || []).length;
    expect(shebangCount).toBe(1);
  });

  it("hasExistingHook returns true when hook has non-snip content", () => {
    installPostCommitHook(tempDir);
    expect(hasExistingHook(tempDir)).toBe(true);
  });
});

describe("hasExistingHook", () => {
  beforeEach(() => {
    initRepoWithCommit();
  });

  it("returns false when hook only contains snip content", () => {
    installPostCommitHook(tempDir);

    // At this point, the hook was freshly created by snip (no pre-existing content)
    expect(hasExistingHook(tempDir)).toBe(false);
  });

  it("returns false when no hook exists", () => {
    expect(hasExistingHook(tempDir)).toBe(false);
  });
});

describe("installPostCommitHook — hook updates", () => {
  beforeEach(() => {
    initRepoWithCommit();
  });

  it("replaces content between sentinels when outdated", () => {
    // Install hook, then manually alter the version in the sentinel block
    installPostCommitHook(tempDir);
    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    let content = readFileSync(hookPath, "utf8");
    content = content.replace(`snip v${HOOK_VERSION}`, "snip v0.0.1");
    writeFileSync(hookPath, content, { mode: 0o755 });

    // Re-install should replace the outdated block
    installPostCommitHook(tempDir);

    const updated = readFileSync(hookPath, "utf8");
    expect(updated).toContain(`snip v${HOOK_VERSION}`);
    expect(updated).not.toContain("snip v0.0.1");
  });

  it("preserves non-snip content before and after sentinels during update", () => {
    const hooksDir = join(tempDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });

    // Create a hook with content before and after the snip section
    const before = '#!/bin/bash\necho "before"\n';
    const snipBlock = [
      "# >>> snip-hook-start >>>",
      "# Installed by snip v0.0.1 — old version",
      "old content",
      "# <<< snip-hook-end <<<",
    ].join("\n");
    const after = '\necho "after"\n';

    writeFileSync(join(hooksDir, "post-commit"), before + snipBlock + after, { mode: 0o755 });

    installPostCommitHook(tempDir);

    const updated = readFileSync(join(hooksDir, "post-commit"), "utf8");
    expect(updated).toContain('echo "before"');
    expect(updated).toContain('echo "after"');
    expect(updated).toContain(`snip v${HOOK_VERSION}`);
    expect(updated).not.toContain("v0.0.1");
  });

  it("is a no-op when hook is already current", () => {
    installPostCommitHook(tempDir);
    const hookPath = join(tempDir, ".git", "hooks", "post-commit");
    const contentBefore = readFileSync(hookPath, "utf8");

    installPostCommitHook(tempDir);

    const contentAfter = readFileSync(hookPath, "utf8");
    expect(contentAfter).toBe(contentBefore);
  });
});

describe("installPostCommitHook — core.hooksPath", () => {
  beforeEach(() => {
    initRepoWithCommit();
  });

  it("installs hook to core.hooksPath directory when configured", () => {
    const customHooksDir = join(tempDir, "custom-hooks");
    mkdirSync(customHooksDir, { recursive: true });
    git("config", "core.hooksPath", customHooksDir);

    installPostCommitHook(tempDir);

    const hookFile = join(customHooksDir, "post-commit");
    const content = readFileSync(hookFile, "utf8");
    expect(content).toContain("# >>> snip-hook-start >>>");
    expect(content).toContain(`snip v${HOOK_VERSION}`);
  });

  it("isHookInstalled checks core.hooksPath when configured", () => {
    const customHooksDir = join(tempDir, "custom-hooks");
    mkdirSync(customHooksDir, { recursive: true });
    git("config", "core.hooksPath", customHooksDir);

    expect(isHookInstalled(tempDir)).toBe(false);

    installPostCommitHook(tempDir);
    expect(isHookInstalled(tempDir)).toBe(true);
  });

  it("hasExistingHook checks core.hooksPath when configured", () => {
    const customHooksDir = join(tempDir, "custom-hooks");
    mkdirSync(customHooksDir, { recursive: true });
    git("config", "core.hooksPath", customHooksDir);

    // Write a pre-existing hook in the custom dir
    writeFileSync(join(customHooksDir, "post-commit"), '#!/bin/bash\necho "custom"\n', { mode: 0o755 });

    expect(hasExistingHook(tempDir)).toBe(true);
  });

  it("does NOT install to .git/hooks when core.hooksPath is set", () => {
    const customHooksDir = join(tempDir, "custom-hooks");
    mkdirSync(customHooksDir, { recursive: true });
    git("config", "core.hooksPath", customHooksDir);

    installPostCommitHook(tempDir);

    const defaultHook = join(tempDir, ".git", "hooks", "post-commit");
    expect(existsSync(defaultHook)).toBe(false);
  });
});

describe("installPostCommitHook — pre-existing repo scenarios", () => {
  it("works on repos with existing branches and remotes without side effects", () => {
    initRepoWithCommit();
    git("branch", "feature");
    git("remote", "add", "origin", "https://example.com/repo.git");

    const branchesBefore = git("branch").trim();
    const logBefore = git("log", "--oneline");

    installPostCommitHook(tempDir);

    const branchesAfter = git("branch").trim();
    const logAfter = git("log", "--oneline");

    expect(branchesAfter).toBe(branchesBefore);
    expect(logAfter).toBe(logBefore);
    expect(isHookInstalled(tempDir)).toBe(true);
  });
});
