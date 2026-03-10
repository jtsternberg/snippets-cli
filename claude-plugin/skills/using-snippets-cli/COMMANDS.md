# snip Command Reference

Complete command reference for the snip CLI.

## Library Setup

### init
Initialize a new snippet library.
```bash
snip init                    # Initialize in default location
snip init ~/my-snippets      # Initialize at specific path
snip init --force            # Reinitialize (overwrites config)
```
Options: `-f`, `--force`

## Adding & Editing Snippets

### add
Add a new snippet to the library.
```bash
snip add                                          # Interactive mode
snip add --from-clipboard --tags "js,async"       # From clipboard with tags
snip add --title "Fetch Helper" --content "..."   # Inline content
snip add --type prompt --lang markdown --tags ai  # Full options
```
Options:
- `-t`, `--type` - Snippet type (e.g., snippet, prompt, reference)
- `-l`, `--lang` - Language identifier
- `--tags` - Comma-separated tags
- `--title` - Snippet title
- `--from-clipboard` - Read content from system clipboard
- `--content` - Provide content inline
- `--provider` - LLM provider override (`ollama`, `gemini`, `gemini-cli`, `claude`, `claude-cli`, `openai`, `openai-cli`, `auto`)

### edit
Open a snippet in the default editor.
```bash
snip edit my-snippet
```

### rename
Rename a snippet. Updates the file, title, and any cross-links.
```bash
snip rename old-slug "New Title Here"
```

### rm
Delete a snippet from the library.
```bash
snip rm my-snippet            # Prompts for confirmation
snip rm my-snippet --force    # Skip confirmation
```
Options: `-f`, `--force`

## Viewing & Copying

### show
Display a snippet's full content.
```bash
snip show my-snippet          # Syntax-highlighted display
snip show my-snippet --raw    # Full file with frontmatter + body
snip show my-snippet --code   # Only fenced code blocks
```
Options: `--raw`, `--code`

### copy
Copy a snippet's content to the system clipboard.
```bash
snip copy my-snippet
```

## Searching & Filtering

### list
List snippets in the library.
```bash
snip list                              # All snippets
snip list --type prompt                # Filter by type
snip list --tag javascript             # Filter by tag
snip list --lang python                # Filter by language
snip list --json                       # JSON output
```
Options:
- `-t`, `--type` - Filter by snippet type
- `--tag` - Filter by tag
- `-l`, `--lang` - Filter by language
- `--json` - Output as JSON

### tags
List all tags with snippet counts.
```bash
snip tags                    # Human-readable list
snip tags --json             # JSON output
```
Options: `--json`

### find
Text search across snippet content and metadata.
```bash
snip find "async await"                       # Basic text search
snip find "hook" --type snippet --tag react   # Filtered search
snip find "deploy" --lang bash --json         # JSON output
```
Options:
- `-t`, `--type` - Filter by type
- `--tag` - Filter by tag
- `-l`, `--lang` - Filter by language
- `--json` - Output as JSON

### search
Semantic search using vector embeddings (requires qmd).
```bash
snip search "error handling patterns"            # Default semantic search
snip search "retry logic" --max 5                # Limit results
snip search "config management" --json           # JSON output
snip search "auth flow" --mode vsearch           # Vector-only search
```
Options:
- `--json` - Output as JSON
- `-n`, `--max` - Maximum number of results
- `--mode` - Search mode: `query` (default), `search`, or `vsearch`

## Templates

### run
Fill template variables in a snippet and copy the result.
```bash
snip run my-template --var name=Widget --var count=5
snip run my-template --no-copy            # Print only, don't copy
snip run my-template --skip-vars          # Skip unfilled variables
```
Options:
- `--var` - Set a template variable (repeatable: `--var key=value`)
- `--no-copy` - Print result to stdout without copying to clipboard
- `--skip-vars` - Leave unfilled variables as-is

## Cross-Linking

### link
Add semantic cross-links between related snippets.
```bash
snip link my-snippet                    # Interactive linking
snip link my-snippet --max 5            # Limit suggestions
snip link my-snippet --auto             # Auto-link without prompting
```
Options:
- `-n`, `--max` - Maximum number of link suggestions
- `--auto` - Automatically add links without confirmation

## Import & Export

### import
Import snippets from files, URLs, or GitHub Gists.
```bash
snip import ./my-file.js                          # Import from file
snip import https://example.com/snippet.py        # Import from URL
snip import file1.js file2.py                     # Multiple sources
snip import ./code.ts --type snippet --tags "ts"  # With metadata
snip import ./notes.md --no-enrich                # Skip LLM enrichment
snip import --from-gist <gist-url-or-id>          # Import from GitHub Gist
snip import --from-gist abc123 --no-enrich        # Import gist without enrichment
```
Options:
- `-t`, `--type` - Snippet type for imported content
- `--tags` - Comma-separated tags
- `--no-enrich` - Skip LLM-powered enrichment (title, tags, description)
- `--from-gist` - Import all files from a GitHub Gist URL or ID
- `--provider` - LLM provider override (`ollama`, `gemini`, `gemini-cli`, `claude`, `claude-cli`, `openai`, `openai-cli`, `auto`)

### export
Export snippets to JSON, markdown, or GitHub Gist.
```bash
snip export                              # Export all as JSON
snip export my-snippet                   # Export single snippet
snip export --format md                  # Export as markdown
snip export --type prompt --tag ai       # Filter what to export
snip export --output ./backup.json       # Write to file
snip export my-snippet --to-gist         # Publish as secret GitHub Gist
snip export my-snippet --to-gist --public  # Publish as public gist
```
Options:
- `-f`, `--format` - Output format: `json` (default) or `md`
- `-t`, `--type` - Filter by type
- `--tag` - Filter by tag
- `-o`, `--output` - Output file path
- `--to-gist` - Publish snippet(s) as a GitHub Gist
- `--public` - Create a public gist (default: secret)

### sync
Sync gist-linked snippets with their GitHub Gists.
```bash
snip sync                    # Auto-detect push/pull for each snippet
snip sync --dry-run          # Preview what would be synced
snip sync --push             # Force push all local changes to gists
snip sync --pull             # Force pull all gist changes to local
```
Options:
- `--push` - Force push local changes to gists
- `--pull` - Force pull gist changes to local
- `--dry-run` - Show what would be synced without making changes

## LLM Enrichment

### enrich
Re-run LLM enrichment on existing snippets to fill missing metadata.
```bash
snip enrich my-snippet          # Enrich a single snippet
snip enrich --all               # Enrich all snippets with missing metadata
snip enrich --all --force       # Regenerate all metadata
snip enrich --all --type prompt # Enrich only prompts
snip enrich --all --dry-run     # Preview without writing
```
Options:
- `--all` - Enrich all snippets
- `--force` - Overwrite existing metadata fields
- `--type` - Filter by snippet type (with `--all`)
- `--dry-run` - Show what would be updated without writing
- `--provider` - LLM provider override (`ollama`, `gemini`, `gemini-cli`, `claude`, `claude-cli`, `openai`, `openai-cli`, `auto`)

## Configuration

### config
View or modify snip configuration.
```bash
snip config                    # Show all config
snip config editor             # Show specific key
snip config editor vim         # Set a config value
snip config --json             # JSON output
```
Options: `--json`

### config:types:add
Add a custom snippet type.
```bash
snip config:types:add checklist
```

### config:llm
View and manage LLM provider configuration (BYOL: Bring Your Own LLM).
```bash
snip config:llm                           # Show LLM config
snip config:llm:provider gemini           # Set primary provider
snip config:llm:provider auto             # Auto-detect best available
snip config:llm:fallback ollama           # Set fallback provider
snip config:llm:key gemini YOUR_KEY       # Set API key
snip config:llm:model ollama llama3.2     # Set model
```
Providers: `ollama`, `gemini`, `gemini-cli`, `claude`, `claude-cli`, `openai`, `openai-cli`, `auto`

## Integrations

### install
Install shell completions, Alfred workflow, or Obsidian vault link.
```bash
snip install completions zsh       # Shell completions
snip install completions bash
snip install alfred                # Alfred workflow
snip install obsidian              # Obsidian vault integration
```

## Maintenance

### doctor
Run health checks on the snippet library and dependencies.
```bash
snip doctor
```

### upgrade
Update snip to the latest version.
```bash
snip upgrade              # Prompts for confirmation
snip upgrade --yes        # Skip confirmation
```
Options: `--yes`
