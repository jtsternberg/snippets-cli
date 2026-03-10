# snip Workflows

Common workflow patterns for snippet management.

## Adding from Clipboard

Capture code you've just copied from a browser, editor, or terminal.

```bash
# Quick add with tags
snip add --from-clipboard --tags "js,fetch,async"

# Add with full metadata
snip add --from-clipboard --type snippet --lang javascript --title "Fetch with Retry" --tags "js,fetch,retry"

# Add a prompt template
snip add --from-clipboard --type prompt --tags "ai,code-review"
```

## Searching and Copying

Find a snippet and get it onto the clipboard in one flow.

```bash
# Text search, then copy
snip find "error handling"
snip copy error-handling-pattern

# Semantic search for conceptual matches
snip search "how to retry failed API calls"
snip copy fetch-with-retry

# Filtered search
snip find "hook" --type snippet --tag react
snip copy use-debounce-hook
```

## Running Prompt Templates

Use snippets with `{{variable}}` placeholders as reusable templates.

```bash
# Fill variables and copy result to clipboard
snip run code-review-prompt --var language=Python --var focus="error handling"

# Preview without copying
snip run email-template --var name=Alice --var topic="Q1 Review" --no-copy

# Skip unfilled variables (leave placeholders intact)
snip run complex-template --var name=Widget --skip-vars
```

## Bulk Import

Import snippets from local files or URLs.

```bash
# Import a single file
snip import ./utils/helpers.js

# Import multiple files at once
snip import ./src/auth.ts ./src/api.ts ./src/hooks.ts

# Import from a URL
snip import https://raw.githubusercontent.com/user/repo/main/snippet.py

# Import without LLM enrichment (faster, no Ollama needed)
snip import ./scripts/*.sh --no-enrich

# Import with explicit metadata
snip import ./deploy.sh --type reference --tags "devops,deploy"
```

## Organizing with Tags and Types

Keep the library navigable as it grows.

```bash
# See what tags exist
snip tags

# List snippets by type
snip list --type prompt
snip list --type reference

# List snippets by tag
snip list --tag python

# Combine filters
snip list --type snippet --tag react --lang typescript

# Add a custom type
snip config:types:add checklist

# Rename for clarity
snip rename old-slug "Better Descriptive Title"
```

## Cross-Linking Related Snippets

Build a connected knowledge graph between snippets.

```bash
# Auto-link a snippet to related ones
snip link my-snippet --auto

# Interactive linking with more candidates
snip link my-snippet --max 10

# Link after adding a new snippet
snip add --from-clipboard --title "React Query Hook"
snip link react-query-hook --auto
```

## Health Check and Maintenance

Keep the library and toolchain in good shape.

```bash
# Run diagnostics
snip doctor

# Update to latest version
snip upgrade

# Export a backup
snip export --output ./snippets-backup.json

# Install shell completions
snip install completions zsh
```

## JSON Automation

Use `--json` output for scripting and piping.

```bash
# Count snippets by type
snip list --json | jq 'group_by(.type) | map({type: .[0].type, count: length})'

# Find most-used tags
snip tags --json | jq 'sort_by(-.count) | .[0:10]'

# Export names matching a search
snip find "util" --json | jq -r '.[].name'

# Batch copy results of a search
for name in $(snip find "helper" --json | jq -r '.[].name'); do
  echo "--- $name ---"
  snip show "$name" --code
done
```
