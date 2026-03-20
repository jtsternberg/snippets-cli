---
title: "feat: Git-Backed Snippet Collections"
type: feat
status: active
date: 2026-03-20
brainstorm: docs/brainstorms/2026-03-20-git-backed-collections-brainstorm.md
---

# feat: Git-Backed Snippet Collections

## Overview

Snippet collections become git repositories automatically. Every `snip` command that modifies files creates a single atomic git commit at the end of the operation — not per file write, but per command invocation. Git's post-commit hook replaces the current inline `updateAndEmbed()` calls for QMD indexing, running asynchronously. QMD errors are persisted and surfaced on the next `snip` command.

## Problem Statement / Motivation

1. **No version history** — snippet edits are destructive. If you overwrite a snippet, the old version is gone.
2. **QMD indexing is tightly coupled** — every write command calls `updateAndEmbed()` inline. If qmd breaks, the command's error handling has to deal with it.
3. **No collaboration path** — collections are local directories with no built-in way to sync between machines (gist sync is per-snippet, not per-collection).
4. **Manual edits go unindexed** — if a user edits a markdown file directly (or via Obsidian), QMD doesn't know about it until `snip reindex`.

## Proposed Solution

### Architecture: Command-Level Commit Windows

Instead of committing after every `writeSnippetFile()` call, introduce a **commit window** pattern:

1. Command starts → open commit window
2. All file writes happen normally (existing `writeSnippetFile()` unchanged)
3. Command finishes → close commit window → stage all changed files → one atomic commit
4. Post-commit hook fires → QMD indexing runs async

This solves the batch problem: `snip enrich --all` touching 50 files = 1 commit. `snip rename` touching 7 files = 1 commit.

### Key Components

```
src/lib/git.ts              — NEW: git operations (init, commit, hook management)
src/lib/qmd-status.ts       — NEW: persistent QMD error state
src/index.ts                 — MODIFY: preAction/postAction hooks for commit windows
src/commands/init.ts         — MODIFY: add git init + hook installation
src/commands/doctor.ts       — MODIFY: add git health checks
src/lib/qmd.ts              — MODIFY: remove inline updateAndEmbed from exports
src/commands/add.ts          — MODIFY: remove updateAndEmbed() call
src/commands/edit.ts         — MODIFY: remove updateAndEmbed() call
src/commands/rm.ts           — MODIFY: remove qmdUpdate() call
src/commands/rename.ts       — MODIFY: (already missing qmd call — this is a gap we fix)
src/commands/enrich.ts       — MODIFY: remove per-snippet updateAndEmbed() calls
src/commands/import.ts       — MODIFY: remove per-file updateAndEmbed() calls
src/commands/sync.ts         — MODIFY: remove inline updateAndEmbed() call
.git/hooks/post-commit       — NEW: installed in collection repo, triggers qmd
```

## Technical Approach

### Phase 1: Git Foundation (`src/lib/git.ts`)

New module for all git operations within the snippet library:

```typescript
// src/lib/git.ts

/** Check if library path has a .git directory */
export function isGitRepo(libraryPath: string): boolean;

/** Initialize git repo in library path, returns true if newly created. No-op if already a repo. */
export function initGitRepo(libraryPath: string): boolean;

/** Install or update the snip post-commit hook. Respects existing hooks — see Hook Strategy below. */
export function installPostCommitHook(libraryPath: string): void;

/** Check if the snip hook section is present and current in post-commit */
export function isHookInstalled(libraryPath: string): boolean;

/** Check if post-commit hook has non-snip content (user's own hooks) */
export function hasExistingHook(libraryPath: string): boolean;

/** Stage all changes and commit with message */
export function commitAll(libraryPath: string, message: string): void;

/** Check if there are uncommitted changes */
export function hasChanges(libraryPath: string): boolean;

/** Check if a remote is configured */
export function hasRemote(libraryPath: string): boolean;
```

All git operations use `execFileSync("git", [...args], { cwd: libraryPath })` — same pattern as the existing `spawnQmd()` but synchronous since commits should block.

**Post-commit hook script** (installed to `.git/hooks/post-commit`):

The snip hook section is wrapped in sentinel markers so it can be identified, updated, and removed without affecting any other hook content:

```bash
# >>> snip-hook-start >>>
# Installed by snip v1.3.0 — triggers QMD re-indexing after commits
# Do not edit between the markers — snip manages this section.
# To remove: run `snip config git:unhook` or delete between the markers.

COLLECTION_NAME="${SNIP_QMD_COLLECTION:-snip}"
STATUS_FILE="$(git rev-parse --show-toplevel)/.snip-qmd-status"

(
  qmd update -c "$COLLECTION_NAME" 2>"$STATUS_FILE" && \
  qmd embed -c "$COLLECTION_NAME" 2>>"$STATUS_FILE" && \
  rm -f "$STATUS_FILE"
) &
# <<< snip-hook-end <<<
```

**Hook installation strategy — respect existing hooks:**

1. **No existing hook file**: Create `.git/hooks/post-commit` with `#!/usr/bin/env bash` shebang + snip section. Set executable bit.
2. **Existing hook file, no snip section**: Append snip section to the end. Print `status.info("Appended snip hook to existing post-commit hook")`. Do NOT modify any existing content.
3. **Existing hook file, outdated snip section**: Replace content between sentinels with current version. Print `status.info("Updated snip hook in post-commit")`.
4. **Existing hook file, current snip section**: No-op. Already installed and up to date.

The `isHookInstalled()` function checks for `snip-hook-start` marker. The `installPostCommitHook()` function uses the sentinels to surgically insert/replace only the snip block.

Key details:
- Sentinel markers (`>>> snip-hook-start >>>` / `<<< snip-hook-end <<<`) isolate snip's section
- Runs in background (`&`) so commit returns instantly
- Writes errors to `.snip-qmd-status` in library root
- Clears status file on success
- Collection name configurable via env var (set by snip)
- Version stamp in comment enables future hook upgrades via `snip doctor`

### Phase 2: QMD Status File (`src/lib/qmd-status.ts`)

```typescript
// src/lib/qmd-status.ts

const STATUS_FILENAME = ".snip-qmd-status";

/** Read and clear the QMD status file, returning error text if present */
export function checkQmdStatus(libraryPath: string): string | null;

/** Surface QMD errors as a warning via status.warn() */
export function surfaceQmdErrors(libraryPath: string): void;
```

Called in the `preAction` hook (Phase 4) so errors from the *last* command's async hook are shown before the *next* command runs.

**Add `.snip-qmd-status` to the `.gitignore` template** in `init.ts` (it's transient state, not content).

### Phase 3: Commit Window Pattern (`src/index.ts`)

Add a `postAction` hook alongside the existing `preAction` hook:

```typescript
// src/index.ts — additions

import { isGitRepo, initGitRepo, installPostCommitHook, commitAll, hasChanges } from "./lib/git.js";
import { surfaceQmdErrors } from "./lib/qmd-status.js";

// Commands that modify snippet files and should trigger git commit
const COMMIT_COMMANDS = new Set([
  "add", "edit", "rm", "rename", "enrich", "import", "sync"
]);

// Commands exempt from library check (existing)
const LIBRARY_EXEMPT = new Set(["init", "doctor", "config", ...]);

program.hook("preAction", (_thisCommand, actionCommand) => {
  const name = actionCommand.name();

  if (!LIBRARY_EXEMPT.has(name)) {
    assertLibraryExists(getLibraryPath());
  }

  // Surface any QMD errors from last async hook run
  const libPath = getLibraryPath();
  if (libPath) {
    surfaceQmdErrors(libPath);
  }

  // Git setup: handles both fresh and pre-existing repos
  if (!LIBRARY_EXEMPT.has(name)) {
    if (!isGitRepo(libPath)) {
      // No repo at all — initialize fresh
      initGitRepo(libPath);
      installPostCommitHook(libPath);
      commitAll(libPath, "snip: initialize git tracking");
    } else if (!isHookInstalled(libPath)) {
      // Pre-existing repo (user set it up themselves, or Obsidian git, etc.)
      // Only install the hook — don't touch their commits, branches, or config
      installPostCommitHook(libPath);
      // installPostCommitHook handles the messaging (appended vs created)
    }
    // If repo exists AND hook is current: nothing to do
  }
});

program.hook("postAction", (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  const libPath = getLibraryPath();

  if (COMMIT_COMMANDS.has(name) && isGitRepo(libPath) && hasChanges(libPath)) {
    // Commit message derived from command context
    const message = buildCommitMessage(name, actionCommand);
    commitAll(libPath, message);
  }
});
```

**Commit message format:**
- `snip: add "my-snippet"` — single snippet operations
- `snip: rename "old-name" → "new-name"` — rename with cross-link updates
- `snip: enrich 12 snippets` — bulk operations
- `snip: import 5 files` — batch import
- `snip: sync 3 pushed, 2 pulled` — gist sync summary

To generate these contextual messages, commands will set metadata on a shared context object (or Commander's `setOptionValue`) that `postAction` reads.

### Phase 4: Remove Inline QMD Calls

Remove `await updateAndEmbed()` and `await qmdUpdate()` from all command files:

| File | Remove | Line (approx) |
|------|--------|----------------|
| `src/commands/add.ts` | `await updateAndEmbed()` | ~195 |
| `src/commands/edit.ts` | `await updateAndEmbed()` | ~37 |
| `src/commands/rm.ts` | `await qmdUpdate()` | ~49 |
| `src/commands/enrich.ts` | `await updateAndEmbed()` | ~117 |
| `src/commands/import.ts` | `await updateAndEmbed()` | ~272 |
| `src/commands/sync.ts` | `await updateAndEmbed()` | (end of sync) |

`src/commands/rename.ts` already has no QMD call — this was a pre-existing gap that git hooks now fix for free.

**`snip reindex`** keeps its direct QMD call — it's explicitly user-triggered and doesn't modify snippet files. It should NOT create a git commit.

### Phase 5: Update Init Command (`src/commands/init.ts`)

After existing collection setup (dirs, .gitignore, README, qmd registration):

```typescript
// After line ~101 in init.ts

// Initialize git repo
initGitRepo(libraryPath);
installPostCommitHook(libraryPath);

// Set SNIP_QMD_COLLECTION for the hook
// (already available via config.qmd.collectionName)

// Initial commit
commitAll(libraryPath, "snip: initialize collection");
```

**Update `.gitignore` template** to include:
```
.qmd/
.DS_Store
.obsidian/workspace.json
.snip-qmd-status
```

### Phase 6: Doctor Additions (`src/commands/doctor.ts`)

New "Git" section in doctor output:

```
Git
  ✓ Repository initialized
  ✓ Post-commit hook installed (v1.3.0)
  ℹ Existing hook content detected — snip hook appended (not replacing)
  ℹ No remote configured — add one with: git -C ~/snippets remote add origin <url>
  ✓ No pending QMD errors
```

Checks:
1. `.git` exists in library path
2. `.git/hooks/post-commit` exists and contains `snip-hook-start` sentinel
3. Hook version is current (compare version stamp in sentinel block)
4. If hook has non-snip content, show info: "Post-commit hook has additional (non-snip) content — preserved"
5. Remote configured (informational `status.info()`, not error)
6. `.snip-qmd-status` file absent or empty
7. If hook outdated, offer: "Run `snip doctor --fix` to update hook to v1.3.0"

### Phase 7: Handle Edge Cases

**Phantom commits from `snip edit`:**
The `postAction` hook's `hasChanges()` check handles this naturally — if the user opens the editor and saves without changes, `git diff` shows nothing, so no commit is created. However, `writeSnippetFile()` currently always updates the `modified` timestamp. We should only update `modified` if content actually changed.

```typescript
// src/commands/edit.ts — add content comparison
const before = readFileSync(filePath, "utf-8");
// ... spawn editor ...
const after = readFileSync(filePath, "utf-8");
if (before !== after) {
  const updated = parseSnippetFile(filePath);
  writeSnippetFile(filePath, updated.frontmatter, updated.content);
}
```

**Gist sync commit grouping:**
The sync command already processes all snippets in a loop, then calls `updateAndEmbed()` once at the end. With the commit window pattern, this becomes: all writes happen during sync → `postAction` creates one commit → hook fires once. The commit message summarizes: `snip: sync 3 pushed, 2 pulled`.

**Config changes:**
`snip config types:add` creates directories and `.base` files but isn't in `COMMIT_COMMANDS`. Library structure changes should be committed too — add `config` to `COMMIT_COMMANDS` (only the subcommands that modify library files).

## Acceptance Criteria

### Functional Requirements

- [ ] `snip init` creates a git repo and installs post-commit hook
- [ ] Existing collections without `.git` get auto-initialized on next snip command
- [ ] Every write command (add, edit, rm, rename, enrich, import, sync) creates exactly one git commit
- [ ] Commit messages are descriptive and follow `snip: <action> "<subject>"` format
- [ ] Post-commit hook triggers QMD update + embed asynchronously
- [ ] QMD errors are persisted to `.snip-qmd-status` and surfaced on next command
- [ ] `snip reindex` still works as a direct QMD call (no git commit)
- [ ] `snip doctor` reports git health (repo, hook, remote, qmd status)
- [ ] `.snip-qmd-status` and `.qmd/` are in `.gitignore`
- [ ] No phantom commits when `snip edit` exits without changes

### Non-Functional Requirements

- [ ] Git operations add < 100ms to command execution time
- [ ] Post-commit QMD hook is fully async (doesn't block git commit return)
- [ ] Graceful degradation if git is not installed (warn, continue without commits)

### Quality Gates

- [ ] Unit tests for `src/lib/git.ts` (mock execFileSync)
- [ ] Unit tests for `src/lib/qmd-status.ts`
- [ ] Integration test: `snip init` → verify `.git` exists + hook installed
- [ ] Integration test: `snip add` → verify git log shows commit
- [ ] Integration test: `snip edit` no-change → verify no new commit
- [ ] Integration test: `snip enrich --all` → verify single commit for N files
- [ ] Integration test: QMD failure → verify `.snip-qmd-status` written + surfaced

## Dependencies & Risks

**Dependencies:**
- Git must be installed (universal on dev machines, but should check gracefully)
- Post-commit hook assumes bash (safe on macOS/Linux, needs testing on Windows/WSL)

**Risks:**
- **Pre-existing repos**: User may already have `git init`'d their collection (or use Obsidian Git plugin). Mitigation: `initGitRepo()` is a no-op if `.git` already exists. We never touch their branches, remotes, or config. We only add our hook section via sentinels.
- **Pre-existing hooks**: User may have their own post-commit hooks (linting, Obsidian sync, etc.). Mitigation: sentinel-wrapped hook section is appended to existing hooks, never replaces them. `hasExistingHook()` detects non-snip content. Doctor reports it informatively.
- **Hook managers (husky, lefthook, etc.)**: Some tools replace `.git/hooks/` entirely via `core.hooksPath`. Mitigation: check `git config core.hooksPath` — if set, install to that directory instead. Doctor should warn if `core.hooksPath` is set and our hook isn't there.
- **Performance on large collections**: `git add -A` on 1000+ snippets could be slow. Mitigation: stage only known-changed files via `git add <specific-files>` instead of `-A`. Commands know which files they wrote.
- **Concurrent access**: If user runs two snip commands simultaneously, commits could race. Mitigation: git's own lockfile handles this — second commit waits for first to complete.

## Implementation Order (TDD — Tests First)

Each step writes failing tests, then implements just enough code to make them pass.

### Step 1: `src/lib/git.ts` — Unit Tests → Implementation

**Tests first** (`tests/lib/git.test.ts`):

*Core operations:*
- `isGitRepo()` returns false for plain directory, true after `git init`
- `initGitRepo()` creates `.git` directory, returns true on first call
- `initGitRepo()` returns false (no-op) when `.git` already exists — does not reinitialize
- `commitAll()` stages and commits all changes, commit message matches input
- `commitAll()` is a no-op when `hasChanges()` is false
- `hasChanges()` detects new files, modified files, deleted files
- `hasRemote()` returns false with no remote, true after adding one
- `isGitInstalled()` returns boolean (mock `which git`)

*Hook installation — fresh repo:*
- `installPostCommitHook()` creates `.git/hooks/post-commit` with shebang + snip section
- Created hook has executable bit set
- `isHookInstalled()` returns true after install

*Hook installation — pre-existing hooks:*
- `installPostCommitHook()` appends snip section to existing hook content
- Existing hook content is fully preserved above the snip section
- Existing shebang line is NOT duplicated
- `hasExistingHook()` returns true when hook has non-snip content
- `hasExistingHook()` returns false when hook only has snip content

*Hook updates:*
- `installPostCommitHook()` replaces content between sentinels when snip section is outdated
- Non-snip content before/after sentinels is preserved during update
- `isHookInstalled()` version check: returns false when sentinel block has old version stamp

*Pre-existing repo scenarios:*
- `initGitRepo()` on a repo with existing commits does NOT create a new commit
- `initGitRepo()` on a repo with uncommitted changes does NOT stage or commit them
- `installPostCommitHook()` works on repos with existing branches, remotes, tags (no side effects)

**Then implement** `src/lib/git.ts` — each function just enough to pass its tests.

### Step 2: `src/lib/qmd-status.ts` — Unit Tests → Implementation

**Tests first** (`tests/lib/qmd-status.test.ts`):
- `checkQmdStatus()` returns null when no status file exists
- `checkQmdStatus()` returns error text when status file has content
- `checkQmdStatus()` deletes the status file after reading (clear on read)
- `surfaceQmdErrors()` calls `status.warn()` with the error text
- `surfaceQmdErrors()` is silent when no errors present

**Then implement** `src/lib/qmd-status.ts`.

### Step 3: `src/commands/init.ts` — Integration Tests → Implementation

**Tests first** (`tests/commands/init.test.ts` additions):
- `snip init <dir>` creates `.git` in library directory
- `snip init <dir>` installs post-commit hook with qmd trigger
- `snip init <dir>` creates initial commit with message `snip: initialize collection`
- `.gitignore` includes `.snip-qmd-status`
- Git log shows exactly 1 commit after init

**Then modify** `src/commands/init.ts` to call `initGitRepo()`, `installPostCommitHook()`, `commitAll()`.

### Step 4: `src/index.ts` — Integration Tests → Implementation (Commit Window + Auto-Init)

**Tests first** (`tests/integration.test.ts` additions):

*Auto-init tests (no existing repo):*
- Running any snip command on a collection without `.git` initializes git automatically
- Auto-init creates initial commit with all existing files

*Pre-existing repo tests:*
- Running snip command on a collection with existing `.git` does NOT reinitialize
- Pre-existing repo's commit history is preserved (no extra "initialize" commit)
- Pre-existing repo gets snip hook installed if missing
- Pre-existing repo with existing post-commit hook gets snip section appended
- Pre-existing repo with current snip hook is left completely untouched

*Commit window tests:*
- `snip add` creates exactly 1 git commit containing the new file
- `snip rm` creates exactly 1 git commit removing the file
- `snip rename` creates exactly 1 git commit (renamed file + updated cross-links)
- Commit messages follow `snip: <action> "<subject>"` format

*QMD error surfacing tests:*
- Write a fake `.snip-qmd-status` → next snip command prints warning
- Status file is cleared after being surfaced

**Then implement** preAction/postAction hooks in `src/index.ts`.

### Step 5: Remove Inline QMD Calls — Integration Tests → Implementation

**Tests first** (`tests/integration.test.ts` additions):
- `snip add` does NOT call `qmd update` directly (verify no qmd subprocess spawned during command)
- `snip edit` does NOT call `qmd update` directly
- `snip rm` does NOT call `qmd update` directly
- `snip reindex` STILL calls `qmd update` directly (exemption)

**Then remove** `await updateAndEmbed()` / `await qmdUpdate()` from add, edit, rm, enrich, import, sync.

### Step 6: `src/commands/edit.ts` — Unit Tests → Implementation (Phantom Commit Prevention)

**Tests first** (`tests/commands/edit.test.ts` additions):
- `snip edit` with no content change → no new git commit created
- `snip edit` with no content change → `modified` timestamp unchanged
- `snip edit` with actual change → commit created, `modified` updated

**Then modify** `src/commands/edit.ts` to compare before/after content.

### Step 7: `src/commands/doctor.ts` — Unit Tests → Implementation

**Tests first** (`tests/commands/doctor.test.ts` additions):
- Doctor reports "Repository initialized" when `.git` exists
- Doctor warns "No git repository" when `.git` missing
- Doctor reports "Post-commit hook installed (v1.3.0)" when hook present and current
- Doctor warns "Post-commit hook outdated" when snip section has old version
- Doctor warns "Post-commit hook missing" when no snip sentinel found
- Doctor shows info "Post-commit hook has additional (non-snip) content — preserved" when `hasExistingHook()`
- Doctor shows info "No remote configured" with add-remote hint
- Doctor reports "No pending QMD errors" when status file absent
- Doctor warns when `.snip-qmd-status` has content
- Doctor warns if `core.hooksPath` is set and snip hook isn't in that directory

**Then modify** `src/commands/doctor.ts` to add Git section.

### Step 8: `.gitignore` Update

Update the `.gitignore` template in `init.ts` to include `.snip-qmd-status`. (Already tested in Step 3.)

### Step 9: End-to-End Integration Tests

Final round of integration tests covering full workflows:

*Fresh collection:*
- `snip init` → `snip add` → `snip edit` → `snip rm` → verify git log has 3 commits (init + add + rm, edit was no-op or has content change)
- `snip init` → manually create file → `snip reindex` → verify no git commit from reindex
- Bulk: `snip add` x5 → 5 separate commits (one per command invocation)
- Error path: corrupt `.snip-qmd-status` → verify graceful handling

*Pre-existing repo:*
- User `git init`'d collection with 3 existing commits → `snip add` → verify 4 commits total (3 original + 1 new)
- User has post-commit hook running a linter → `snip add` → verify both linter AND qmd hooks run
- User has Obsidian Git plugin `.git` with its own hooks → snip appends, doesn't break Obsidian sync
- User has `core.hooksPath` set → snip installs to correct directory

*Hook lifecycle:*
- Install hook → update snip (new version) → `snip doctor` detects outdated → `snip doctor --fix` updates sentinel block only

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-03-20-git-backed-collections-brainstorm.md`
- Current QMD integration: `src/lib/qmd.ts` (spawnQmd pattern, updateAndEmbed)
- Existing preAction hook: `src/index.ts:83-87`
- Doctor checks pattern: `src/commands/doctor.ts` (status.ok/warn/info helpers)
- Write helper: `src/lib/frontmatter.ts:writeSnippetFile()`
- Gist sync: `src/commands/sync.ts` (multi-file write pattern)
- Exit codes: `src/lib/config.ts:EXIT_CODES`

### Backlog
- `snip-uf5`: Add `snip log` and `snip diff` convenience commands (depends on this feature)
