---
title: "feat: Build snip CLI - snippet manager with semantic search"
type: feat
status: active
date: 2026-03-09
---

# Build `snip` CLI - Snippet Manager with Semantic Search

## Overview

A TypeScript CLI tool (`snip`) for managing code snippets, AI prompts, and reusable text as Markdown files with Obsidian-compatible YAML frontmatter. Organized by configurable directory-based types, semantically searchable via qmd, enrichable via LLM-powered auto-detection (Ollama-first), with an Alfred workflow for quick capture and search.

## Problem Statement

Developers accumulate code snippets, AI prompts, and reusable text across scattered locations (notes apps, gists, browser extensions, clipboard managers). There's no tool that combines:
- Plain-text, git-friendly storage
- Semantic search (find snippets by concept, not just keywords)
- LLM-powered enrichment (auto-detect language, suggest tags, generate cross-links)
- Obsidian compatibility for visual browsing and graph exploration
- Alfred integration for instant capture/retrieval from anywhere on macOS

## Technical Approach

### Architecture

```
snip (CLI entry point)
├── commands/           # One file per subcommand
│   ├── init.ts
│   ├── add.ts
│   ├── search.ts
│   ├── find.ts
│   ├── list.ts
│   ├── show.ts
│   ├── copy.ts
│   ├── edit.ts
│   ├── run.ts
│   ├── rm.ts
│   ├── rename.ts
│   ├── link.ts
│   ├── tags.ts
│   ├── import.ts
│   ├── export.ts
│   ├── config.ts
│   ├── doctor.ts
│   └── obsidian.ts
├── lib/
│   ├── config.ts       # Config loading/saving (~/.config/snip/config.json)
│   ├── frontmatter.ts  # gray-matter wrapper, Obsidian-compatible read/write
│   ├── resolve.ts      # Name resolution: slug, fuzzy match, alias lookup
│   ├── snippet.ts      # Snippet CRUD operations
│   ├── clipboard.ts    # clipboardy wrapper
│   ├── qmd.ts          # qmd CLI wrapper (child_process)
│   ├── llm.ts          # Ollama/cloud API provider chain
│   ├── obsidian.ts     # Obsidian CLI wrapper (child_process)
│   └── alfred.ts       # Alfred JSON formatter
├── types/
│   └── index.ts        # Shared TypeScript types
└── index.ts            # Commander program definition
```

### Technology Stack

| Concern | Library | Version |
|---------|---------|---------|
| CLI framework | `commander` + `@commander-js/extra-typings` | v14+ |
| Frontmatter | `gray-matter` | v4+ |
| Clipboard | `clipboardy` | v4+ (ESM) |
| Local LLM | `ollama` (npm) | Latest |
| Semantic search | `qmd` (CLI, via child_process) | Latest |
| Bundler | `tsup` | Latest |
| Test runner | `vitest` | v3+ |
| Syntax highlight | `cli-highlight` | Latest |
| Interactive prompts | `@inquirer/prompts` | Latest |
| Spinner/progress | `ora` | Latest |

### Key Design Decisions

#### 1. Config Location & Library Path

Global config at `~/.config/snip/config.json`:

```json
{
  "libraryPath": "~/snippets",
  "types": ["snippets", "prompts"],
  "defaultType": "snippets",
  "editor": "$EDITOR",
  "llm": {
    "provider": "ollama",
    "ollamaModel": "llama3.1",
    "ollamaHost": "http://localhost:11434",
    "fallbackProvider": "openai",
    "openaiApiKey": null,
    "anthropicApiKey": null
  },
  "qmd": {
    "collectionName": "snip"
  },
  "alfred": {
    "maxResults": 20
  }
}
```

- Single library per config. Multiple libraries possible by pointing `libraryPath` to different directories or using `SNIP_LIBRARY` env var override.
- `snip init [path]` creates the library at the given path (default: `~/snippets`) and writes the global config.
- Re-running `snip init` on an existing library: detect, warn, abort unless `--force`.

#### 2. Snippet File Format

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
date: 2026-03-09
modified: 2026-03-09
source: "https://example.com/docs"
related:
  - "[[parse-xml-response]]"
---

Extract and parse JSON from HTTP responses.

` ` `python
import json

def extract_json(response):
    return json.loads(response.text)
` ` `
```

Prompt format adds `variables` field:

```markdown
---
title: Code Review Prompt
tags:
  - code-review
type: prompt
variables:
  - language
  - focus_area
date: 2026-03-09
modified: 2026-03-09
---

` ` `prompt
Review this {{language}} code focusing on {{focus_area}}.
Identify bugs, performance issues, and style improvements.
` ` `
```

#### 3. Name Resolution Strategy

All commands accepting `<name>` use a shared resolver (`lib/resolve.ts`):

1. **Exact slug match** — `extract-json` matches `snippets/extract-json.md`
2. **Slug with type prefix** — `prompts/code-review` matches `prompts/code-review.md`
3. **Alias match** — check `aliases` frontmatter field across all snippets
4. **Fuzzy match** — if no exact match, show top fuzzy matches and prompt user to select
5. **Error if nothing found** — clear message with suggestions

#### 4. Copy Semantics

`snip copy <name>` extracts:
- **Single code block**: content inside the fence (no fence markers)
- **Multiple code blocks**: concatenate with blank line separators
- **No code block**: full body minus frontmatter

All "display" commands (`show`, `list`, `find`, `tags`) write to **stdout**.
All "copy" commands (`copy`, `run`) write to **both clipboard AND stdout** (pipes work).
`search` is interactive by default; `--json` makes it stdout-only.

#### 5. Filename Convention

Slugified title only: `extract-json-from-api-response.md`
- Collisions: append `-2`, `-3`, etc.
- `snip rename` updates the filename AND all `[[wikilinks]]` referencing it

#### 6. Graceful Degradation Matrix

| Feature | qmd unavailable | Ollama unavailable | No cloud API | No network |
|---------|----------------|-------------------|-------------|-----------|
| `snip add` | Works, no embed/crosslinks | Works, no auto-detect | Works, no auto-detect | Works, manual only |
| `snip search` | Falls back to `snip find` | N/A | N/A | Works (local) |
| `snip find` | Works (text search) | N/A | N/A | Works |
| `snip copy/show` | Works | N/A | N/A | Works |
| `snip run` | Works | N/A | N/A | Works |
| `snip link` | Warns, skips | N/A | N/A | Works (local) |

Core CRUD always works. LLM and semantic search enhance but never block.

#### 7. Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Snippet not found |
| 3 | Config/init error |
| 4 | External tool error (qmd, Ollama) |

### Implementation Phases

#### Phase 1: Foundation (Core CRUD + Config)

Establish the project, core snippet operations, and config management. No external integrations yet.

**Setup:**
- [x] Initialize npm project with TypeScript, ESM (`"type": "module"`)
- [x] Configure tsup for building, vitest for testing
- [x] Set up `package.json` with `bin: { "snip": "./dist/index.js" }`
- [x] Create project structure: `src/commands/`, `src/lib/`, `src/types/`

**Config system (`src/lib/config.ts`):**
- [x] Load/save config from `~/.config/snip/config.json`
- [x] Support `SNIP_LIBRARY` env var override for library path
- [x] Validate config schema on load
- [x] Provide defaults for all optional fields

**Frontmatter engine (`src/lib/frontmatter.ts`):**
- [x] Parse with gray-matter, return typed `Snippet` object
- [x] Serialize with `matter.stringify()`, preserving Obsidian compatibility
- [x] Auto-update `modified` field on writes
- [x] Handle `tags` as array (Obsidian format), `related` as quoted wikilinks
- [ ] Validate against Obsidian property type constraints

**Name resolver (`src/lib/resolve.ts`):**
- [x] Exact slug match (across all type directories)
- [x] Type-prefixed match (`prompts/code-review`)
- [x] Alias lookup (scan frontmatter `aliases` fields)
- [x] Fuzzy fallback with interactive selection
- [x] Clear error messages with "did you mean?" suggestions

**Commands:**
- [x] `snip init [path]` — create library directory, subdirs for configured types, write config, `.gitignore` (ignore `.qmd/` cache)
- [x] `snip add [--type] [--lang] [--tags]` — interactive creation: prompt for title, open `$EDITOR` for content, generate frontmatter, write file
- [x] `snip add --from-clipboard` — read clipboard, write file with placeholder title (slug: `untitled-YYYY-MM-DD-HHMMSS`), print path
- [x] `snip show <name>` — resolve name, display with syntax highlighting via `cli-highlight`
- [x] `snip copy <name>` — resolve name, extract code block content, write to clipboard + stdout
- [x] `snip edit <name>` — resolve name, open in `$EDITOR` (fall back to `vi`), update `modified` on save
- [x] `snip rm <name>` — resolve name, confirm (unless `--force`), delete file, warn about broken cross-links
- [x] `snip list [--type] [--tag] [--lang]` — list snippets with filters, sorted by `modified` descending
- [x] `snip tags` — aggregate and display all tags with counts
- [x] `snip config [key] [value]` — get/set config values, `snip config types add agents` for type management
- [x] `snip rename <old> <new>` — rename file, update slug, update `[[wikilinks]]` in other files

**Types (`src/types/index.ts`):**
- [x] `Snippet` type: `{ title, tags, aliases, language, type, date, modified, source, related, variables, content, filePath }`
- [x] `SnipConfig` type matching the config JSON schema
- [x] `ResolveResult` type for name resolution

**Tests:**
- [x] Unit tests for frontmatter parsing/serialization (round-trip fidelity)
- [ ] Unit tests for name resolution (exact, prefix, alias, fuzzy, collision)
- [x] Unit tests for slug generation and collision handling
- [ ] Integration tests for init, add, show, copy, edit, rm, list, tags, rename

**Phase 1 success criteria:**
- `snip init ~/my-snippets` creates a working library
- `snip add`, `snip copy`, `snip show`, `snip edit`, `snip rm` all work
- `snip list --tag python` filters correctly
- Files are valid Obsidian markdown (openable in Obsidian with correct properties)
- All output goes to stdout, copy goes to clipboard + stdout
- Shell completions generated for bash/zsh/fish

---

#### Phase 2: Search (qmd + text search)

Add semantic and text search capabilities.

**qmd wrapper (`src/lib/qmd.ts`):**
- [x] Check if qmd is installed (`which qmd`), provide install instructions if missing
- [x] `registerCollection(path, name)` — `qmd collection add <path> --name <name>`
- [x] `embed()` — `qmd embed` (with ora spinner)
- [x] `search(query, options)` — `qmd query "<query>" -c <collection> --json`, parse results
- [x] `update()` — `qmd update` to refresh index
- [x] Handle qmd not installed gracefully (warn once per session, fall back to text search)

**Commands:**
- [x] `snip search <query>` — semantic search via qmd, display interactive TUI (inquirer select), auto-copy on select
- [x] `snip search <query> --json` — output Alfred-compatible Script Filter JSON (non-interactive)
- [x] `snip find <query>` — grep-like text search across filenames, frontmatter, and content; non-interactive, stdout output
- [x] `snip doctor` — check qmd install, collection health, Ollama reachability, config validity

**Integration hooks:**
- [x] `snip add` post-hook: run `qmd update && qmd embed` after adding a snippet
- [x] `snip edit` post-hook: run `qmd update && qmd embed` after editing
- [x] `snip rm` post-hook: run `qmd update` after deletion

**`--json` output schema for Alfred:**
```json
{
  "items": [{
    "uid": "snippets/extract-json",
    "title": "Extract JSON from API Response",
    "subtitle": "python | tags: api, parsing",
    "arg": "/path/to/snippets/extract-json.md",
    "autocomplete": "Extract JSON from API Response",
    "icon": { "path": "icons/python.png" },
    "mods": {
      "cmd": { "subtitle": "Copy to clipboard", "arg": "CODE_CONTENT_HERE" },
      "alt": { "subtitle": "Open in editor", "arg": "/path/to/file.md" }
    },
    "text": { "copy": "CODE_CONTENT_HERE", "largetype": "CODE_CONTENT_HERE" },
    "quicklookurl": "/path/to/file.md",
    "variables": { "snippet_slug": "extract-json", "snippet_type": "snippet" }
  }]
}
```

**Tests:**
- [x] Unit tests for qmd wrapper (mock child_process)
- [x] Unit tests for Alfred JSON output format
- [ ] Integration tests for search flow (requires qmd installed)
- [x] Test graceful degradation when qmd is missing

**Phase 2 success criteria:**
- `snip search "parse json"` returns semantically relevant results
- `snip find "json"` does fast text search
- `snip search --json` outputs valid Alfred Script Filter JSON
- `snip doctor` reports health status of all integrations
- Adding/editing/deleting snippets keeps the qmd index up to date

---

#### Phase 3: LLM Integration (auto-detect + enrichment)

Add Ollama-first LLM features for language detection, auto-tagging, and description generation.

**LLM provider chain (`src/lib/llm.ts`):**
- [x] `isOllamaAvailable()` — `GET http://localhost:11434` with 2s timeout
- [x] `detectLanguage(code)` — send code to LLM, parse response for language identifier
- [x] `suggestTags(content, existingTags)` — generate tag suggestions based on content and existing tag vocabulary
- [x] `generateDescription(content)` — one-line description for untitled snippets
- [x] Provider chain: try Ollama -> try cloud API (if key configured) -> return null (skip gracefully)
- [ ] Rate limit / batch awareness for cloud APIs
- [x] Config-driven model selection per provider

**Enhance existing commands:**
- [x] `snip add --from-clipboard` — auto-detect language, suggest tags, generate title (LLM-powered)
- [ ] `snip add` (interactive) — offer LLM-suggested tags after content entry, user can accept/reject/edit
- [x] `snip link <name>` — use qmd to find semantically related snippets, prompt user to confirm, add `related` wikilinks to frontmatter

**Prompt template support:**
- [x] `snip run <prompt-name> [--var key=value ...]` — parse `{{variables}}` from content, fill with provided values
- [x] Interactive mode: if TTY available and variables missing, prompt for each one
- [x] Non-interactive: error if variables missing (for piping)
- [x] Output to clipboard + stdout
- [x] `variables` frontmatter field documents expected variables with optional defaults

**Tests:**
- [x] Unit tests for LLM provider chain (mock Ollama/cloud responses)
- [ ] Unit tests for language detection parsing
- [x] Unit tests for template variable extraction and filling
- [x] Unit tests for `snip run` with missing/extra variables
- [ ] Integration tests with real Ollama (optional, skip in CI if unavailable)

**Phase 3 success criteria:**
- `snip add --from-clipboard` with Python code auto-detects `python` language and suggests relevant tags
- When Ollama is unavailable, commands complete without error (just skip LLM features)
- `snip run review-prompt --var language=python --var focus_area=security` fills and copies
- `snip link extract-json` finds and suggests related snippets

---

#### Phase 4: Alfred Workflow

Build the Alfred workflow for search and quick capture.

**Alfred workflow package:**
- [ ] Create `alfred/` directory in repo with workflow structure
- [ ] Script Filter for search: calls `snip search --json "{query}"`, pipes to Alfred
- [ ] Universal Action for capture: reads clipboard, calls `snip add --from-clipboard --json`, returns confirmation
- [ ] Modifier keys: Cmd = copy, Alt = open in editor, Ctrl = reveal in Finder
- [ ] Keyword trigger: configurable (default: `snip`)
- [ ] Workflow environment variable for `snip` binary path
- [ ] Icons per language (bundled PNGs or SF Symbols)
- [ ] Error display: if library not initialized or qmd fails, show actionable error item
- [ ] `snip alfred:install` command to symlink/copy workflow into `~/Library/Application Support/Alfred/Alfred.alfredpreferences/workflows/`

**Tests:**
- [ ] Verify JSON output matches Alfred Script Filter schema
- [ ] Test modifier key action args
- [ ] Test error item format when library is uninitialized

**Phase 4 success criteria:**
- Typing `snip query` in Alfred shows ranked snippet results
- Selecting a result copies snippet content to clipboard
- Cmd+select opens in editor, Alt+select shows in terminal
- Selecting text anywhere and triggering the universal action creates a new snippet with auto-detected language

---

#### Phase 5: Obsidian Integration & Polish

Obsidian CLI integration, import/export, and documentation.

**Obsidian CLI wrapper (`src/lib/obsidian.ts`):**
- [ ] `isObsidianRunning()` — check if Obsidian process is running
- [ ] `getBacklinks(file)` — `obsidian backlinks file="<name>" format=json`
- [ ] `getLinks(file)` — `obsidian links file="<name>" format=json`
- [ ] `findOrphans()` — `obsidian orphans format=json`
- [ ] `findUnresolved()` — `obsidian unresolved format=json`

**Commands:**
- [ ] `snip obsidian` — print setup guide: how to open library as vault, recommended plugins (Git, Dataview, Tag Wrangler, Templater), recommended settings
- [ ] `snip obsidian:check` — if Obsidian is running with the library as a vault, report orphan snippets, unresolved links, link integrity
- [ ] `snip import <file|url|glob>` — import from: raw code files (wrap in frontmatter), existing Markdown with frontmatter, glob patterns for bulk import, URLs (fetch raw content)
- [ ] `snip import --from-gist <gist-url>` — import all files from a GitHub Gist
- [ ] `snip export <name> [--format json|gist|md]` — export snippet(s) to various formats
- [ ] `snip export --to-gist <name>` — publish snippet as GitHub Gist (future phase, stub for now)

**Shell completions:**
- [ ] Generate bash/zsh/fish completions via Commander's built-in support
- [ ] Complete snippet names, tags, types, and languages dynamically
- [ ] `snip completions [bash|zsh|fish]` command to print completion script

**Documentation:**
- [ ] README.md with installation, quickstart, command reference
- [ ] Obsidian setup guide (recommended plugins, settings, opening library as vault)
- [ ] Alfred workflow installation instructions
- [ ] Config reference with all options explained

**Tests:**
- [ ] Unit tests for Obsidian CLI wrapper (mock child_process)
- [ ] Integration tests for import from various sources
- [ ] Integration tests for export formats
- [ ] End-to-end test: init -> add -> search -> copy -> edit -> rm lifecycle

**Phase 5 success criteria:**
- `snip obsidian` prints a clear setup guide
- `snip import *.py` bulk imports Python files with auto-generated frontmatter
- Shell completions work for snippet names and tags
- Full lifecycle test passes

---

#### Phase 6: GitHub Gist Sync (Future)

- [ ] `snip export --to-gist <name>` — publish to GitHub Gist via `gh` CLI
- [ ] `snip import --from-gist <url>` — import from Gist
- [ ] Bidirectional sync: track gist ID in frontmatter, detect changes
- [ ] `snip sync` — push/pull changes to/from linked gists

---

## Acceptance Criteria

### Functional Requirements

- [ ] `snip init` creates a working library with config
- [ ] `snip add` creates Obsidian-compatible Markdown files with proper frontmatter
- [ ] `snip add --from-clipboard` auto-detects language via LLM
- [ ] `snip search` returns semantically relevant results via qmd
- [ ] `snip copy` extracts code block content to clipboard + stdout
- [ ] `snip run` fills `{{variable}}` templates and outputs result
- [ ] `snip rm` deletes with confirmation and index cleanup
- [ ] `snip rename` updates filename and all wikilinks
- [ ] Alfred workflow provides search and quick capture
- [ ] All snippet files are valid Obsidian vault notes

### Non-Functional Requirements

- [ ] Core CRUD works without qmd, Ollama, or network
- [ ] `snip search` returns results in < 2 seconds for 1000+ snippets
- [ ] `snip copy` returns in < 100ms
- [ ] Clean exit codes for scripting (0, 1, 2, 3, 4)
- [ ] All commands support `--help`
- [ ] Shell completions for bash/zsh/fish

### Quality Gates

- [ ] > 80% test coverage for `src/lib/`
- [ ] All commands have integration tests
- [ ] `npm run build` produces working `snip` binary
- [ ] `npm link` installs globally and all commands work
- [ ] Linting passes (eslint + prettier)

## Dependencies & Prerequisites

- **Node.js >= 22** (required by qmd)
- **qmd** (`npm i -g @tobilu/qmd`) — optional but recommended
- **Ollama** — optional, for LLM features
- **Obsidian v1.12.4+** — optional, for Obsidian CLI integration
- **Alfred 5+** — optional, for Alfred workflow

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| qmd API changes | Search breaks | Pin qmd version, wrap in abstraction layer |
| Ollama not running | No auto-detect | Graceful degradation, clear messaging |
| gray-matter doesn't round-trip perfectly | Frontmatter corruption | Extensive round-trip tests, pin version |
| Obsidian CLI not available | No cross-link verification | All Obsidian features optional |
| Alfred workflow complexity | Long development time | Phase 4 is independent, can ship CLI without it |
| Wikilink rot from renames/deletes | Broken cross-references | `snip rename` updates links, `snip doctor` detects broken links |

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-03-09-snippets-cli-brainstorm.md`

### External References
- [qmd - GitHub](https://github.com/tobi/qmd)
- [Obsidian CLI](https://help.obsidian.md/cli)
- [Obsidian Properties](https://help.obsidian.md/properties)
- [Commander.js](https://github.com/tj/commander.js)
- [gray-matter](https://github.com/jonschlinkert/gray-matter)
- [Alfred Script Filter JSON](https://www.alfredapp.com/help/workflows/inputs/script-filter/json/)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [ai-snippet-manager (reference)](https://github.com/MMilosevic87/ai-snippet-manager)
- [clipboardy](https://github.com/sindresorhus/clipboardy)
