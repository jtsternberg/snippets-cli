# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Claude Code plugin with skills, slash commands, and snippet-specialist agent
- `snip install claude-code` to install/update the Claude Code plugin from the CLI
- Plugin marketplace manifest (`.claude-plugin/marketplace.json`)

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
