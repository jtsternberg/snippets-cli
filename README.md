# snippets-cli (snip)

<img src="assets/snippet-clipboard.svg" alt="snippets-cli icon" width="100" align="right" />

CLI snippet manager with semantic search, Obsidian-compatible markdown storage, and LLM enrichment.

## Features

- **Local-first markdown storage** — Obsidian-compatible, plain files you own
- **Semantic search** via [qmd](https://github.com/tobilu/qmd) vector embeddings
- **LLM-powered auto-enrichment** — language detection, tags, and descriptions via Ollama
- **Alfred workflow** integration for macOS
- **Shell completions** for bash, zsh, and fish
- **Multiple snippet types** — snippets, prompts, or custom categories
- **Import** from files, globs, or URLs
- **Export** to JSON or Markdown

## Installation

```bash
npm install -g @jtsternberg/snip
```

Requires **Node.js 22+**.

### From source

```bash
git clone https://github.com/jtsternberg/snippets-cli.git
cd snippets-cli
npm install
npm run build
npm link
```
## Quick Start

```bash
snip init                          # Initialize library at ~/snippets
snip add --from-clipboard          # Add snippet from clipboard
snip add --title "My Script" --lang bash  # Add with metadata
snip search "api helper"           # Semantic search
snip copy my-snippet               # Copy to clipboard
snip show my-snippet               # Display in terminal
```

## Commands

| Command | Description |
| --- | --- |
| `snip init` | Initialize snippet library and config |
| `snip add` | Add a new snippet (interactive or scripted) |
| `snip show <name>` | Display snippet (`--raw`, `--code`) |
| `snip copy <name>` | Copy snippet to clipboard |
| `snip edit <name>` | Open snippet in editor |
| `snip rm <name>` | Delete a snippet |
| `snip list` | List snippets (`--type`, `--tag`, `--lang`, `--json`) |
| `snip tags` | List all tags |
| `snip search <query>` | Semantic search (`--json`, `-n`, `--mode`) |
| `snip find <query>` | Fuzzy text search |
| `snip rename <name> <new-name>` | Rename a snippet |
| `snip run <name>` | Execute a snippet as a shell script |
| `snip link <name>` | Create symlink to snippet |
| `snip import <sources...>` | Import from files, globs, or URLs |
| `snip export [name]` | Export to JSON or Markdown (`--format`, `--output`, `--to-gist`) |
| `snip config` | View or set configuration |
| `snip config:types:add <name>` | Add a snippet type |
| `snip install <integration>` | Install integrations (completions, alfred, obsidian) |
| `snip upgrade` | Update snip and reinstall integrations |
| `snip doctor` | Health check |

## Configuration

Config file: `~/.config/snip/config.json`

| Setting | Description | Default |
| --- | --- | --- |
| `libraryPath` | Path to snippet library | `~/snippets` |
| `types` | Snippet type directories | `["snippets", "prompts"]` |
| `defaultType` | Default type for new snippets | — |
| `editor` | Editor for `snip edit` (falls back to `$EDITOR`) | — |
| `llm.provider` | LLM provider | `"ollama"` |
| `llm.ollamaModel` | Ollama model | `"llama3.1"` |
| `qmd.collectionName` | qmd collection name | — |
| `alfred.maxResults` | Max Alfred results | — |

### Environment Variables

- `SNIP_LIBRARY` — Override library path
- `EDITOR` — Fallback editor

## Snippet Format

Snippets are stored as markdown files with YAML frontmatter:

```markdown
---
title: API Request Helper
description: Fetch wrapper with error handling
tags:
  - javascript
  - api
aliases:
  - fetch-helper
language: javascript
type: snippets
date: "2026-03-09"
modified: "2026-03-09"
source: ""
related:
  - "[[error-handling]]"
---

```javascript
async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```
```

The `related` field uses Obsidian-style wikilinks for cross-referencing between snippets.

## Integrations

### Alfred Workflow

```bash
snip install alfred
```

- **`snip` keyword** — search snippets
- **Enter** — paste snippet
- **Cmd+Enter** — copy to clipboard
- **Alt+Enter** — open file
- **Ctrl+Enter** — reveal in Finder
- **`snipsaveclipboard` keyword** — save clipboard as a new snippet

### Shell Completions

```bash
snip install completions        # Auto-detect shell
snip install completions zsh    # Specific shell
```

### Obsidian

```bash
snip install obsidian
```

Opens your snippet library as an Obsidian vault. Snippets use wikilinks in `related` fields for cross-referencing.

### Semantic Search (qmd)

Install [qmd](https://github.com/tobilu/qmd) for semantic/vector search:

```bash
npm i -g @tobilu/qmd
```

### LLM Enrichment (Ollama)

Install [Ollama](https://ollama.ai) for auto-enrichment (language detection, tags, descriptions):

```bash
brew install ollama
ollama pull llama3.1
```

## Claude Code Plugin

This repository includes a [Claude Code plugin](claude-plugin/.claude-plugin/README.md) for AI-assisted snippet management. Add, search, and organize snippets using natural language.

### Quick Example

```
You: "Save this function to my snippets with tags js and util"
You: "Find all my Python snippets about error handling"
You: "Run my code-review prompt template with language=TypeScript"
```

### Installation

In Claude Code:
```
/plugin marketplace add jtsternberg/snippets-cli
/plugin install snippets-cli
```

Or point to your existing copy of the snippets-cli repository:
```
/plugin marketplace add ./snippets-cli
/plugin install snippets-cli
```

### Features

- **Skills**: Auto-invoked when discussing snippets, code fragments, or prompt templates
- **Commands**: `/snippets-cli:add`, `/snippets-cli:find`, `/snippets-cli:show`
- **Agent**: Snippet specialist for complex multi-step workflows

See [claude-plugin/.claude-plugin/README.md](claude-plugin/.claude-plugin/README.md) for full documentation.
## Development

```bash
npm run dev          # Watch mode
npm test             # Run tests
npm run build        # Build for production
npm run typecheck    # Type checking
```

## License

MIT
