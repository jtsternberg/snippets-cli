import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const HOOK_VERSION = "1.4.0";

const HOOK_START = "# >>> snip-hook-start >>>";
const HOOK_END = "# <<< snip-hook-end <<<";

const HOOK_BODY = `# >>> snip-hook-start >>>
# Installed by snip v${HOOK_VERSION} — triggers QMD re-indexing after commits
# Do not edit between the markers — snip manages this section.
# To remove: run \`snip config git:unhook\` or delete between the markers.

command -v qmd >/dev/null 2>&1 || exit 0

COLLECTION_NAME="\${SNIP_QMD_COLLECTION:-snip}"
STATUS_FILE="$(git rev-parse --show-toplevel)/.snip-qmd-status"

(
  qmd update -c "$COLLECTION_NAME" 2>"$STATUS_FILE" && \\
  qmd embed -c "$COLLECTION_NAME" 2>>"$STATUS_FILE" && \\
  rm -f "$STATUS_FILE"
) </dev/null >/dev/null 2>&1 &
# <<< snip-hook-end <<<`;

function gitExec(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

export function isGitInstalled(): boolean {
  try {
    execFileSync("git", ["--version"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

export function isGitRepo(libraryPath: string): boolean {
  try {
    gitExec(["rev-parse", "--is-inside-work-tree"], libraryPath);
    return true;
  } catch {
    return false;
  }
}

export function initGitRepo(libraryPath: string): boolean {
  if (isGitRepo(libraryPath)) {
    return false;
  }
  gitExec(["init"], libraryPath);
  return true;
}

export function hasChanges(libraryPath: string): boolean {
  const status = gitExec(["status", "--porcelain"], libraryPath).trim();
  return status.length > 0;
}

export function commitAll(libraryPath: string, message: string): void {
  if (!hasChanges(libraryPath)) {
    return;
  }
  gitExec(["add", "-A"], libraryPath);
  gitExec(["commit", "-m", message], libraryPath);
}

export function hasRemote(libraryPath: string): boolean {
  const remotes = gitExec(["remote"], libraryPath).trim();
  return remotes.length > 0;
}

function hookPath(libraryPath: string): string {
  return join(libraryPath, ".git", "hooks", "post-commit");
}

export function isHookInstalled(libraryPath: string): boolean {
  const path = hookPath(libraryPath);
  if (!existsSync(path)) {
    return false;
  }
  const content = readFileSync(path, "utf8");
  return content.includes(HOOK_START);
}

export function hasExistingHook(libraryPath: string): boolean {
  const path = hookPath(libraryPath);
  if (!existsSync(path)) {
    return false;
  }
  const content = readFileSync(path, "utf8");

  // Strip the snip section and shebang, then check if anything meaningful remains
  const withoutSnip = removeSnipSection(content);
  const withoutShebang = withoutSnip.replace(/^#!.*\n?/, "");
  return withoutShebang.trim().length > 0;
}

function removeSnipSection(content: string): string {
  const startIdx = content.indexOf(HOOK_START);
  if (startIdx === -1) {
    return content;
  }
  const endIdx = content.indexOf(HOOK_END);
  if (endIdx === -1) {
    return content;
  }
  const beforeStart = content.substring(0, startIdx);
  const afterEnd = content.substring(endIdx + HOOK_END.length);
  return beforeStart + afterEnd;
}

function isHookCurrent(content: string): boolean {
  return content.includes(`snip v${HOOK_VERSION}`);
}

export function installPostCommitHook(libraryPath: string): void {
  const path = hookPath(libraryPath);
  const hooksDir = join(libraryPath, ".git", "hooks");
  mkdirSync(hooksDir, { recursive: true });

  if (!existsSync(path)) {
    // No existing hook — create from scratch
    const content = `#!/usr/bin/env bash\n${HOOK_BODY}\n`;
    writeFileSync(path, content, { mode: 0o755 });
    return;
  }

  const existing = readFileSync(path, "utf8");

  if (existing.includes(HOOK_START)) {
    // Snip section already present — check if current
    if (isHookCurrent(existing)) {
      return; // Already up to date
    }
    // Replace the outdated section
    const startIdx = existing.indexOf(HOOK_START);
    const endIdx = existing.indexOf(HOOK_END) + HOOK_END.length;
    const before = existing.substring(0, startIdx);
    const after = existing.substring(endIdx);
    const updated = before + HOOK_BODY + after;
    writeFileSync(path, updated, { mode: 0o755 });
    return;
  }

  // Existing hook without snip section — append
  let content = existing;
  if (!content.endsWith("\n")) {
    content += "\n";
  }
  content += HOOK_BODY + "\n";
  writeFileSync(path, content, { mode: 0o755 });
}
