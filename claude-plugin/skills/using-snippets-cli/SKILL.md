---
name: using-snippets-cli
description: Manages code snippets via the snip CLI tool. Use when adding, searching, organizing, or retrieving snippets, prompt templates, and code fragments stored as Obsidian-compatible markdown.
triggers:
  - snippet management
  - saving code snippets
  - searching snippets
  - prompt templates
  - snippet library
  - snip command
---

# Using snippets-cli

The `snip` CLI manages a local library of code snippets, prompt templates, and reference fragments stored as Obsidian-compatible markdown files.

## Prerequisites

- `snip` CLI installed and on PATH (`npm i -g snippets-cli` or clone + `npm link`)
- A snippet library initialized (`snip init`)
- Optional: `qmd` for semantic search (`snip doctor` to verify)
- Optional: Ollama for LLM-powered enrichment during import

## Quick Reference

### Adding & Retrieving
```bash
snip add --from-clipboard --tags "js,util"    # Add from clipboard
snip add --title "My Snippet" --content "..."  # Add inline
snip show my-snippet                           # Display snippet
snip show my-snippet --code                    # Show only code blocks
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
snip tags                                      # Show all tags with counts
snip rename old-name "New Title"               # Rename snippet
snip link my-snippet --auto                    # Auto-link related snippets
```

### Templates
```bash
snip run my-template --var name=Widget         # Fill template variables
snip run my-template --var name=Widget --no-copy  # Print without copying
```

## JSON Output

Add `--json` to `list`, `tags`, `find`, and `search` for machine-readable output:

```bash
snip list --json | jq '.[].name'
snip tags --json | jq '.[] | select(.count > 3)'
snip find "query" --json | jq '.[].title'
snip search "query" --json | jq '.[].score'
```

See COMMANDS.md for full command reference, WORKFLOWS.md for detailed patterns.
