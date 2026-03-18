---
name: using-snippets-cli
description: Manages code snippets via the snip CLI. Saves, searches, organizes, and retrieves reusable code, commands, and prompt templates stored as Obsidian-compatible markdown. Triggers on snip commands, snippets, code fragments, prompt templates, or snippet library operations.
---

# Using snippets-cli

The `snip` CLI manages a local library of code snippets, prompt templates, and executable commands stored as Obsidian-compatible markdown files.

## Prerequisites

- `snip` CLI installed and on PATH (`npm i -g snippets-cli` or clone + `npm link`)
- A snippet library initialized (`snip init`)
- Optional: `qmd` for semantic search (`snip doctor` to verify)
- Optional: `gh` CLI for GitHub Gist sync (`gh auth login` to authenticate)
- Optional: An LLM provider for enrichment — Ollama (default), Gemini, Claude, or OpenAI (`snip config:llm`)

## Core Commands

```bash
snip add --title "..." --content "..." --type <type> --tags "..."  # Add a snippet
snip show <name>                          # View a snippet
snip show <name> --raw                    # View with frontmatter metadata
snip copy <name>                          # Copy to clipboard
snip find "query"                         # Text search
snip search "query"                       # Semantic search (requires qmd)
snip exec <name> -- args                  # Execute a command snippet
snip run <name> --var key=value           # Fill a prompt template
snip rm <name> --force                    # Delete a snippet
snip list --json                          # List all snippets (JSON)
snip tags                                 # Show all tags with counts
```

## The Type → Execution Rule

The `--type` flag on `snip add` determines where a snippet is stored and how it should be used:

| Type | Stored in | Execute with | Purpose |
|------|-----------|-------------|---------|
| `command` | `command/` | `snip exec <name>` | Runnable shell commands and scripts |
| `prompt` | `prompt/` | `snip run <name> --var k=v` | Templates with `{{variables}}` |
| `snippet` | `snippet/` | `snip show` / `snip copy` | Code fragments for reference |
| `reference` | `reference/` | `snip show` / `snip copy` | Documentation and notes |

**After creating a snippet, always tell the user the retrieval command based on its type.**

**IMPORTANT**: Types must be registered before use. Check available types with `snip config --json` (look at the `types` array). If the desired type isn't registered, add it first with `snip config:types:add <type>`. Using an unregistered type may silently create orphaned files that `snip` cannot find.

## When to Use What

**User wants to save code/command for reuse**:
1. Check registered types: `snip config --json` → look at `types` array
2. Is it executable? → `--type command` (register first if needed: `snip config:types:add command`)
3. Is it a template with `{{variables}}`? → `--type prompt`
4. Otherwise → use the default type (usually `snippets`)
5. `snip add --title "..." --content "..." --type <type> --tags "..."`
6. Tell user how to use it based on type (see table above)

**User wants to find a snippet**:
1. Know the name? → `snip show <name>`
2. Know keywords? → `snip find "query"`
3. Conceptual search? → `snip search "query"`

**User wants to import from files/URLs**:
→ `snip import <source> --type <type> --tags "..."`

**User reports snip errors**:
→ Run `snip doctor` first. See troubleshooting-snippets skill for detailed diagnosis.

**Library path is wrong or inaccessible**:
→ `snip config:library ~/snippets` — set the library path (creates it with `snip init` if needed)

## Agent Guidelines

### Use `--help` liberally

When unsure about a command's flags or behavior, run `snip <command> --help` before guessing. Every snip subcommand supports `--help`. This is faster and more reliable than inferring flags from memory.

### Always use non-interactive flags

These commands prompt for input without flags — agents MUST provide them:

| Command | Required flags | Why |
|---------|---------------|-----|
| `snip add` | `--title` and (`--content`, positional arg, or `--from-clipboard`) | Bare `snip add` opens interactive mode |
| `snip rm` | `--force` | Prompts for confirmation without it |
| `snip link` | `--auto` | Interactive selection without it |
| `snip upgrade` | `--yes` | Prompts for confirmation without it |

### Never use

- `snip edit` — opens `$EDITOR`, blocks non-interactive agents
- `snip run ... | sh` — use `snip exec` instead
- Bare `snip add` (no title/content) — triggers interactive mode

### After creating a snippet

Always tell the user the appropriate retrieval/execution command:
- `--type command` → "Run it with: `snip exec <name> -- args`"
- `--type prompt` → "Use it with: `snip run <name> --var key=value`"
- Other types → "View with `snip show <name>` or copy with `snip copy <name>`"

### JSON output for programmatic use

Add `--json` to `list`, `tags`, `find`, and `search` when processing results programmatically.

## Detailed Reference

For complete command documentation with all flags and options: [COMMANDS.md](COMMANDS.md)

For workflow patterns (bulk import, gist sync, LLM config, cross-linking, JSON automation): [WORKFLOWS.md](WORKFLOWS.md)
