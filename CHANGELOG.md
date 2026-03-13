# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-03-12

### Added

- `snip exec` now supports passing arguments to scripts via `--` separator (e.g., `snip exec my-script -- arg1 arg2`)

### Changed

- `snip exec` now uses temp-file-based execution with `spawnSync` for all interpreters, improving security and consistency
- Unified `LANG_TO_SHELL` and `LANG_TO_EXT` into a single `LANG_CONFIG` map to prevent drift
- Dry-run output now quotes each argument with `JSON.stringify` for clarity when args contain spaces

### Fixed

- Path traversal protection in snippet resolution — names with `../` can no longer escape the library directory
- Temp file cleanup now logs a warning on failure instead of silently swallowing errors

## [1.0.0] - 2026-03-10

### Added

- **BYOL (Bring Your Own LLM)** — multi-provider support for metadata enrichment: Ollama (default), Gemini, Claude, and OpenAI, via API keys or CLI tools
- Provider variants for CLI tools: `gemini-cli`, `claude-cli`, `openai-cli` (use installed CLIs instead of API keys)
- `snip enrich [name]` command to re-run LLM enrichment on existing snippets (`--all`, `--force`, `--dry-run`)
- `snip config:llm` subcommands: `config:llm:provider`, `config:llm:fallback`, `config:llm:key`, `config:llm:model`
- `--provider` flag on `add`, `import`, and `enrich` commands for per-invocation LLM override
- Auto-fallback provider chain (`auto` mode) that tries available providers in order
- **Gist sync** — bidirectional GitHub Gist synchronization for snippets
- `snip export --to-gist` to publish snippets as GitHub Gists
- `snip import --from-gist` to import snippets from GitHub Gists
- `snip sync` for bidirectional gist synchronization (`--push`, `--pull`, `--force`)
- Dynamic config key completions for all shells
- Spinner during LLM enrichment in `add` command
- Language verification fact-check after LLM enrichment
- Show enriched field details in `enrich` command output

### Changed

- LLM provider registry now derives valid providers dynamically
- LLM enrichment runs before file creation for correct title/slug
- Enrich command updates code fence language and moves prompts

### Fixed

- `enrich --force` now blanks title and language for full regeneration
- Shell completion descriptions grouped by type directory with type/slug values
- Escape colons in zsh completions for subcommand names
- Include snippet type/directory in shell completion descriptions

## [0.1.1] - 2026-03-10

### Added

- `snip exec` command to execute snippets as scripts with auto-detected interpreter
- Claude Code plugin with skills, slash commands, and snippet-specialist agent
- `snip install claude-code` to install/update the Claude Code plugin from the CLI
- Plugin marketplace manifest (`.claude-plugin/marketplace.json`)

### Fixed

- Clean exit on Ctrl+C during interactive prompts (no more stack trace)

## [0.1.0] - 2026-03-10

### Added

- Core `snip` CLI with commands for adding, showing, editing, running, importing, and exporting snippets
- LLM-augmented snippet enrichment when adding new snippets
- `snip run` command with `--skip-vars` flag for executing snippets
- `snip show` with `--raw` and `--code` display options
- `snip import` and `snip export` commands for snippet portability
- `snip install completions` with dynamic shell completion generation
- `snip install alfred` with Script Filter workflow, Universal Action, and keyword capture for saving snippets
- `snip install obsidian` setup guide with doctor-style settings and plugin validation
- `snip upgrade` command for self-updating
- `snip doctor` with shell completions check
- Obsidian CLI wrapper library
- Chalk-colored CLI output
- MIT license

### Fixed

- Suppressed noisy qmd update/embed output
- Handled editor command strings with arguments (e.g., `cursor -w`)
- Corrected deep config key comparison in upgrade flow
