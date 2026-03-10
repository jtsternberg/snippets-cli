# snippets-cli Claude Code Plugin

A Claude Code plugin for managing code snippets via the `snip` CLI.

## Installation

### From GitHub

```bash
/plugin marketplace add jtsternberg/snippets-cli
/plugin install snippets-cli
```

### From local path (development)

```bash
/plugin marketplace add ./snippets-cli
/plugin install snippets-cli
```

Restart Claude Code after installation to activate.

## Prerequisites

- `snip` CLI installed and on PATH (`npm i -g snippets-cli` or clone + `npm link`)
- A snippet library initialized (`snip init`)
- Optional: `qmd` for semantic search (`snip doctor` to verify)
- Optional: Ollama for LLM enrichment

## What's Included

### Skills (auto-activated)

- **using-snippets-cli** - Contextual help for snippet management conversations
- **troubleshooting-snippets** - Diagnostic workflow for snip issues

### Commands (user-invoked)

- `/snippets-cli:add` - Add a snippet interactively or from clipboard
- `/snippets-cli:find` - Search snippets by text with filters
- `/snippets-cli:show` - Display a snippet by name

### Agents

- **snippet-specialist** - Autonomous agent for complex snippet operations
