# Git-Backed Snippet Collections

**Date:** 2026-03-20
**Status:** Complete

## What We're Building

Snippet collections become git repositories automatically. Every `snip` write operation (add, edit, rm, rename) creates a git commit, giving collections full version history for free. Git's post-commit hook replaces the current inline `updateAndEmbed()` calls for QMD indexing, running asynchronously so commands stay fast. Errors from async QMD indexing are stored locally and surfaced as warnings on the next `snip` command.

This enables three things at once:
1. **Version history** — track snippet changes over time, diff, revert
2. **Automation hooks** — git hooks as reliable infrastructure for QMD indexing (and future automation)
3. **Collaboration** — push/pull collections between machines or share with others via remotes

## Why This Approach

**Git-First (always-on) over Git-Optional** because:
- Two code paths (git on/off) means double the maintenance and half the reliability
- Git is ubiquitous — every developer has it, every machine has it
- Auto-commit with no user action means zero friction — it's invisible until you need the history
- Post-commit hooks catch manual file edits too (if user commits manually), unlike inline `updateAndEmbed()`

**Replace `updateAndEmbed()` rather than supplement** because:
- Single source of truth for indexing — hooks fire regardless of how the commit happens
- Eliminates the current tight coupling between snip write operations and QMD
- But: async hooks need error handling — store failures in a status file, surface on next snip command

## Key Decisions

1. **Auto-commit always** — every `snip add/edit/rm/rename` creates a silent git commit. No opt-in, no config toggle.

2. **Auto-init git** — `snip init` runs `git init` in the collection. Existing collections without `.git` get initialized automatically on next snip command (no prompt).

3. **QMD via git hooks only** — post-commit hook triggers `qmd update` + `qmd embed` asynchronously. Current `updateAndEmbed()` calls in add/edit/rm are removed.

4. **Async QMD error handling** — QMD hook runs in background. Errors written to a status file (e.g., `.snip-qmd-status` or similar). Every snip command checks this file on startup and surfaces warnings/errors if present.

5. **Local-only to start** — `git init` only, no remote setup. `snip doctor` includes a check for "no remote configured" as an informational suggestion, not an error.

6. **Commit message format** — structured messages like `snip: add "my-snippet"`, `snip: edit "my-snippet"`, `snip: rm "my-snippet"` so history is scannable.

## Design Details

### Init Flow (new collection)
```
snip init ~/snippets
  -> mkdir + type dirs + .gitignore + README (existing)
  -> git init
  -> install post-commit hook
  -> register qmd collection (existing)
  -> initial commit: "snip: initialize collection"
```

### Init Flow (existing collection, no .git)
```
snip add "something"
  -> detect no .git in library path
  -> git init
  -> install post-commit hook
  -> git add -A && commit "snip: initialize git tracking"
  -> proceed with add + commit as usual
```

### Write Operation Flow
```
snip add "my-snippet"
  -> create file (existing flow)
  -> git add <file>
  -> git commit -m 'snip: add "my-snippet"'
  -> post-commit hook fires (async):
     -> qmd update -c snip
     -> qmd embed -c snip
     -> on error: write to .snip-qmd-status
```

### QMD Error Surfacing
```
snip <any command>
  -> on startup, check .snip-qmd-status
  -> if errors present:
     -> print warning: "QMD indexing failed: <error>. Run `snip reindex` to retry."
     -> clear status file after displaying
```

### snip doctor Additions
- Check: `.git` exists in library path
- Check: post-commit hook installed and correct
- Check: remote configured (informational, not error)
- Check: QMD status file for unresolved errors

### Git Hook Management
- Hook script installed to `.git/hooks/post-commit`
- If user has existing hooks, append or use a hook dispatcher
- `snip doctor` can detect stale/missing hooks and offer to reinstall

## Resolved Questions

1. **Hook installation strategy** — Plain shell script in `.git/hooks/post-commit`. No dependencies, easy to inspect and debug.

2. **Multi-file operations** — Single atomic commit for the whole operation (e.g., `snip: rename old-name -> new-name`).

3. **Reindex command** — Direct QMD call, bypasses git hooks. It's user-triggered and doesn't change files.

4. **History commands** — `snip log` and `snip diff` convenience commands deferred to backlog (beads task created). Users can use git directly in the meantime.

## Out of Scope (for now)

- Automatic remote setup / GitHub repo creation
- Conflict resolution for multi-machine sync
- Branch-based snippet workflows
- Git LFS for large snippets
- `snip log <snippet>` / `snip diff <snippet>` (backlog)
