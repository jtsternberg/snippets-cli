---
name: using-snippets-cli
description: Manages code snippets via the snip CLI tool. Use when the user mentions snip, snippets, code fragments, prompt templates, snippet library, or wants to save, search, organize, or retrieve code stored as Obsidian-compatible markdown.
---

# Using snippets-cli

The `snip` CLI manages a local library of code snippets, prompt templates, and reference fragments stored as Obsidian-compatible markdown files.

## Prerequisites

- `snip` CLI installed and on PATH (`npm i -g snippets-cli` or clone + `npm link`)
- A snippet library initialized (`snip init`)
- Optional: `qmd` for semantic search (`snip doctor` to verify)
- Optional: `gh` CLI for GitHub Gist sync (`gh auth login` to authenticate)
- Optional: An LLM provider for enrichment — Ollama (default), Gemini, Claude, or OpenAI (`snip config:llm`)

## Quick Reference

### Adding Snippets
```bash
snip add --from-clipboard --tags "js,util"           # Add from clipboard
snip add --title "My Snippet" --content "..."        # Add inline
snip add --title "Deploy" --content "..." --type command  # Add as command (executable)
snip add --title "Prompt" --content "..." --type prompt   # Add as prompt (template)
snip add --from-clipboard --lang python --tags "util"     # Specify language
```

The `--type` flag determines the subdirectory and how the snippet should be used:
- `--type command` → stored in `command/`, run with `snip exec`
- `--type prompt` → stored in `prompt/`, run with `snip run`
- Other types (snippet, reference, etc.) → stored in their respective directories

### Retrieving Snippets
```bash
snip show my-snippet                           # Display snippet (formatted)
snip show my-snippet --code                    # Show only code block content (no fences)
snip show my-snippet --raw                     # Full file with frontmatter (useful for inspecting metadata)
snip copy my-snippet                           # Copy to clipboard
```

### Searching
```bash
snip find "async function"                     # Text search
snip find "hook" --type prompt --tag react     # Filtered text search
snip search "error handling patterns"          # Semantic search (requires qmd)
```

### Organizing
```bash
snip list                                      # List all snippets
snip list --type prompt --tag ai               # Filter by type and tag
snip list --lang python                        # Filter by language
snip tags                                      # Show all tags with counts
snip rename old-name "New Title"               # Rename snippet and update cross-links
snip link my-snippet --auto                    # Auto-link related snippets
snip rm my-snippet                             # Delete a snippet (prompts for confirmation)
snip rm my-snippet --force                     # Delete without confirmation
```

### Templates (snip run)
```bash
snip run my-template --var name=Widget         # Fill template variables, copy to clipboard
snip run my-template --var name=Widget --no-copy  # Print without copying
```

Use `snip run` for **prompt-type** snippets with `{{variables}}` — it substitutes values and copies the result.

### Executing Scripts (snip exec)
```bash
snip exec my-command                           # Execute a command/script snippet
snip exec my-command -- arg1 arg2              # Pass positional args (fill {{vars}} in order)
snip exec my-command --dry-run                 # Preview without executing
snip exec my-command --shell python3           # Override interpreter
```

Use `snip exec` for **command-type** snippets — it actually runs the snippet as a script.

**The rule: `--type command` → `snip exec`, `--type prompt` → `snip run`. Do NOT suggest `snip run ... | sh` — that's what `snip exec` is for.**

### Importing Snippets
```bash
snip import ./script.sh                        # Import from local file
snip import "./scripts/*.sh"                   # Import from glob pattern
snip import https://example.com/snippet.py     # Import from URL
snip import --from-gist <gist-url-or-id>       # Import from GitHub Gist
snip import ./file.sh --type command --tags "deploy"  # With type and tags
snip import ./file.sh --no-enrich              # Skip LLM enrichment
```

### Exporting Snippets
```bash
snip export my-snippet                         # Export as JSON to stdout
snip export my-snippet -f md                   # Export as Markdown
snip export my-snippet --to-gist               # Publish as secret GitHub Gist
snip export my-snippet --to-gist --public      # Publish as public gist
snip export -t command -o commands.json        # Export all commands to file
```

### GitHub Gist Sync
```bash
snip sync                                      # Sync all gist-linked snippets
snip sync --dry-run                            # Preview sync actions
```

### Enrichment
```bash
snip enrich my-snippet                         # Re-run LLM enrichment on one snippet
snip enrich --all                              # Enrich all snippets with missing metadata
snip enrich --all --force                      # Overwrite existing metadata too
snip enrich my-snippet --dry-run               # Preview what would change
snip enrich --provider gemini                  # Use specific LLM provider
```

### Configuration
```bash
snip config                                    # View current config
snip config --json                             # Full config as JSON
snip config snippetDir                         # Get a specific config value
snip config:llm                                # View LLM provider settings
snip config:llm:provider gemini                # Set primary LLM provider
snip config:llm:fallback ollama                # Set fallback provider
snip config:llm:key gemini <api-key>           # Set API key for a provider
snip config:llm:model gemini gemini-2.0-flash  # Set model for a provider
snip config:types:add recipe                   # Add a custom snippet type directory
```

LLM providers: `ollama`, `gemini`, `gemini-cli`, `claude`, `claude-cli`, `openai`, `openai-cli`, `auto`

### Troubleshooting
```bash
snip doctor                                    # Check library health and integrations
snip upgrade                                   # Update snip CLI and reinstall integrations
snip install completions zsh                   # Install shell completions
snip install claude-code                       # Install Claude Code plugin
```

## JSON Output

Add `--json` to `list`, `tags`, `find`, and `search` for machine-readable output:

```bash
snip list --json | jq '.[].name'
snip tags --json | jq '.[] | select(.count > 3)'
snip find "query" --json | jq '.[].title'
snip search "query" --json | jq '.[].score'
```

## Agent Warnings

- **Do NOT use `snip edit`** — it opens `$EDITOR` which blocks non-interactive agents. Use `snip show --raw` to read, then modify the file directly if needed.
- **Do NOT suggest `snip run ... | sh`** — use `snip exec` instead.
