# Snippets CLI Brainstorm

**Date:** 2026-03-09
**Status:** Draft

## What We're Building

A CLI tool (`snip`) for managing code snippets, AI prompts, and reusable text as Markdown files with Obsidian-compatible YAML frontmatter. Snippets are organized in configurable directory-based types, semantically searchable via qmd, and enrichable via LLM-powered auto-detection. An Alfred workflow provides quick capture and search.

### Core Value Proposition

- **Obsidian-native storage** — snippets are plain Markdown files, immediately browsable in Obsidian with full property/tag/linking support
- **Semantic search** — qmd provides local hybrid search (BM25 + vector + LLM re-ranking) across all snippets
- **AI-powered enrichment** — auto-detect language, generate tags, create cross-links on new snippets
- **Fast capture** — Alfred workflow for instant snippet creation from highlighted/copied text
- **First-class prompt support** — dedicated `prompt` code fence language with {{variable}} template syntax

## Why This Approach

### Node.js/TypeScript

Same ecosystem as qmd (npm), rich CLI libraries (commander/yargs, inquirer, ink), easy distribution via npm. TypeScript gives type safety without build complexity.

### Markdown + YAML Frontmatter (Obsidian-compatible)

- Files are the database — no proprietary format, git-friendly, portable
- Obsidian compatibility means a rich GUI for free (graph view, search, backlinks)
- YAML frontmatter follows Obsidian's property spec: typed fields, `tags` as list, `aliases`, wikilinks in quotes

### Directory-based types + tags

- Configurable directory types (default: `snippets/`, `prompts/`) — users add their own (e.g., `agents/`, `skills/`, `templates/`)
- Freeform tags for cross-cutting concerns
- Type-specific behavior possible (e.g., prompts get template variable support)

### qmd for search

- Local-first, no cloud dependency for search
- Hybrid pipeline (FTS + vector + reranking) is ideal for finding snippets by concept
- MCP integration means AI agents can search your snippets too

### Ollama-first LLM integration

- Prefer local Ollama for language detection, auto-tagging, description generation
- Fall back to cloud APIs (OpenAI, Anthropic) if configured
- No LLM required for core functionality — graceful degradation

## Key Decisions

1. **CLI name:** `snip`
2. **Language:** Node.js/TypeScript
3. **Storage:** Standalone configurable directory (not tied to a specific Obsidian vault, but docs explain how to open it as one)
4. **Organization:** Configurable directory-based types + freeform tags
5. **Default types:** `snippets/`, `prompts/` (user adds more via config)
6. **Code fences:** Syntax-specific (e.g., ` ```bash `, ` ```python `, ` ```prompt `)
7. **Prompt support:** First-class — `prompt` code fence language, `{{variable}}` template syntax, dedicated `prompts/` directory
8. **Template variables:** `{{variable}}` syntax in prompts, filled at execution time via `snip run`
9. **Search backend:** qmd (hybrid semantic search)
10. **LLM priority:** Ollama first, cloud API fallback, configurable
11. **Clipboard:** `snip copy <name>` command + auto-copy on interactive search select
12. **Alfred:** Capture from clipboard with auto-detect (language, tags), save immediately with default title
13. **Obsidian integration:** Via Obsidian CLI for cross-linking, backlinks, tag management; docs for recommended vault setup and plugins (especially Obsidian Git)

## Snippet File Format

```markdown
---
title: Extract JSON from API Response
tags:
  - api
  - parsing
aliases:
  - json extract
language: python
type: snippet
created: 2026-03-09
modified: 2026-03-09
source: "https://example.com/docs"
related:
  - "[[parse-xml-response]]"
  - "[[api-error-handling]]"
---

# Extract JSON from API Response

Brief description of what this snippet does.

` ` `python
import json

def extract_json(response):
    return json.loads(response.text)
` ` `
```

### Prompt File Format

```markdown
---
title: Code Review Prompt
tags:
  - code-review
  - development
type: prompt
variables:
  - language
  - focus_area
created: 2026-03-09
modified: 2026-03-09
related:
  - "[[refactoring-prompt]]"
---

# Code Review Prompt

` ` `prompt
Review the following {{language}} code with a focus on {{focus_area}}.

Identify:
- Potential bugs
- Performance issues
- Style improvements

Be specific and provide corrected code examples.
` ` `
```

## CLI Commands (Draft)

```
snip init                          # Initialize a snippet library
snip add [--type snippet|prompt|...] [--lang <lang>] [--tags <tags>]
snip add --from-clipboard          # Create from clipboard content
snip edit <name>                   # Open in $EDITOR
snip copy <name>                   # Copy snippet content to clipboard
snip search <query>                # Interactive semantic search (auto-copies on select)
snip find <query>                  # Quick text search (non-semantic)
snip list [--type] [--tag] [--lang]
snip show <name>                   # Display snippet in terminal
snip run <prompt-name> [--var key=value]  # Fill template variables, copy result
snip tags                          # List all tags
snip link <name>                   # Run qmd to find and add semantic cross-links
snip config                        # Manage settings (library path, LLM provider, types)
snip import <file|url>             # Import from file, URL, or JSON backup
snip obsidian                      # Tips/setup for using library as Obsidian vault
```

## Integration Points

### qmd
- `snip init` registers the library as a qmd collection
- `snip search` calls `qmd query` for hybrid semantic search
- `snip add` triggers `qmd embed` on new files + `qmd query` to find related snippets for cross-linking
- Output format: `--json` for programmatic use, interactive TUI for humans

### Obsidian CLI
- `snip link` can use `obsidian links` / `obsidian backlinks` to verify cross-references
- `snip add` can use `obsidian property:set` to set frontmatter if Obsidian is running
- `snip obsidian` subcommand for vault setup guidance

### Alfred Workflow
- **Search:** Alfred keyword triggers `snip search --json`, displays results, copies on select
- **Create:** Alfred universal action captures selected text / clipboard, calls `snip add --from-clipboard` with auto-detect
- Auto-detect uses LLM to identify language and suggest tags

### LLM Integration
- Language detection from code content
- Auto-tag suggestion based on content analysis
- Description generation for untitled snippets
- Semantic cross-link discovery (complement to qmd)
- Provider chain: Ollama -> OpenAI -> Anthropic (configurable)

## Obsidian Vault Recommendations (for docs)

- **Obsidian Git plugin** — auto-commit and push snippets to GitHub
- **Dataview plugin** — query snippets by frontmatter properties
- **Templater plugin** — create snippet templates
- **Tag Wrangler** — bulk rename/merge tags
- Recommended `.obsidian/` config settings for snippet-friendly display

## Resolved Questions

1. **Filename convention:** Slugified title only (e.g., `extract-json-from-api-response.md`). Frontmatter includes `date` (created) and `modified` fields.
2. **Multi-snippet files:** Multiple code blocks allowed per file, but standard usage is one snippet per file (simplifies copy/paste). Multi-block useful for showing variants or related examples.
3. **Version history:** Git only. Frontmatter has `date` and `modified` timestamps, but git is the real history.
4. **Sync/sharing:** Git/GitHub for now. GitHub Gist sync planned for a future phase.

## Open Questions

_(None remaining)_
