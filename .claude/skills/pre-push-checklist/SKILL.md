---
name: pre-push-checklist
description: This skill should be used before committing or pushing code changes to check whether documentation, shell completions, changelog, plugin docs, or other secondary artifacts need corresponding updates. Triggers when discussing commits, pushes, PRs, or when code changes affect commands, options, configuration, or features.
---

# Pre-Push Checklist

Before committing or pushing code changes, audit the diff against the secondary artifacts listed below. Flag anything that is out of date or missing coverage for the change.

## How to Audit

1. Run `git diff --name-only` (or `git diff --cached --name-only` for staged changes) to identify changed source files.
2. For each category below, check whether the diff introduces something the artifact should reflect.
3. Report a checklist to the user showing what needs updating, what looks fine, and what is uncertain.

## Artifact Categories

### 1. README.md

Update when:
- A new command or subcommand is added or removed (update the **Commands** table)
- A command's options or arguments change
- New configuration keys are added (update the **Configuration** table)
- New environment variables are supported (update the **Environment Variables** list)
- A new integration or feature is added (update the **Features** list)
- Installation steps change

Key sections to check:
- `## Features` — feature bullet list
- `## Commands` — command table
- `## Configuration` — config table and env vars
- `## Integrations` — integration subsections (Alfred, completions, qmd, LLM)

### 2. CHANGELOG.md

Update when:
- Any user-facing change is being committed (new feature, bug fix, breaking change)
- Add an entry under the `## [Unreleased]` section (create one if it does not exist)
- Follow the existing format: `### Added`, `### Changed`, `### Fixed`, `### Removed`

### 3. Claude Plugin Docs

These files mirror the CLI's capabilities for Claude Code users.

| File | Update when |
|------|-------------|
| `claude-plugin/skills/using-snippets-cli/COMMANDS.md` | Commands, options, or arguments change |
| `claude-plugin/skills/using-snippets-cli/SKILL.md` | Prerequisites or quick-reference examples change |
| `claude-plugin/skills/using-snippets-cli/WORKFLOWS.md` | Common usage patterns change |
| `claude-plugin/skills/troubleshooting-snippets/SKILL.md` | New error conditions or troubleshooting steps |
| `claude-plugin/commands/*.md` | The specific command's behavior or options change |
| `claude-plugin/agents/snippet-specialist.md` | Agent capabilities or available tools change |
| `claude-plugin/.claude-plugin/README.md` | Prerequisites, installation, or plugin structure change |
| `claude-plugin/.claude-plugin/plugin.json` | Plugin version or keywords change |

### 4. Shell Completions

Shell completions in `src/commands/install.ts` are generated dynamically by introspecting `program.commands`. They auto-update when new commands are registered in `src/index.ts`.

Flag when:
- A new command is added but **not registered** in `src/index.ts`
- Custom completion logic exists that hardcodes command or option names

### 5. Version Numbers

Check for consistency across:
- `package.json` — `version` field
- `src/index.ts` — `.version()` call
- `claude-plugin/.claude-plugin/plugin.json` — `version` field
- `.claude-plugin/marketplace.json` — `version` field

Flag when any of these are out of sync. Version bumps are typically done at release time, not per-commit — but inconsistencies should be called out.

### 6. package.json Metadata

Update when:
- New keywords are relevant (e.g., a new integration)
- The `description` no longer covers what the tool does
- The `bin` entry changes

### 7. AGENTS.md

Update when:
- Agent workflows or instructions change
- New tools or capabilities are added to the project

## Output Format

Present the checklist as a markdown table:

```
| Artifact | Status | Notes |
|----------|--------|-------|
| README.md | Needs update | New `enrich` command missing from Commands table |
| CHANGELOG.md | Needs entry | New feature not logged |
| Plugin COMMANDS.md | OK | Already up to date |
| ...      | ...    | ...   |
```

Only flag items that are affected by the current diff. Skip categories where nothing changed.

## Tracking Findings with Beads

After presenting the checklist, use beads to track any items that need work:

1. **Check for existing tasks** — Run `bd list --status=open` and `bd search <keyword>` to see if tasks already cover the finding. If so, augment the existing task's description with any new details (`bd update <id> --description="..."`).

2. **Create an epic** if multiple findings exist — Group related checklist items under a single epic so they can be worked as a batch:
   ```bash
   bd create --title="Pre-push checklist fixes for <branch>" --type=task --priority=2
   ```

3. **Create individual tasks** for each finding that needs work, with the epic as parent:
   ```bash
   bd create --title="Update README for <specific gap>" --type=task --priority=2 --parent=<epic-id>
   ```

4. **Link discovered-from** — If the checklist was triggered by a specific feature task or issue, link each new finding back to it using the `discovered-from` dependency type:
   ```bash
   bd dep add <new-task-id> <triggering-issue-id> --type=discovered-from
   ```
   This records that the gap was discovered while working on the triggering issue.
