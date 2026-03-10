# Find Snippets

Search snippets by text with optional filters.

## Usage

/snippets-cli:find <query> [--type=<type>] [--tag=<tag>] [--lang=<language>] [--semantic]

## Arguments

- `query` (required) - Search text
- `--type` - Filter by snippet type
- `--tag` - Filter by tag
- `--lang` - Filter by language
- `--semantic` - Use semantic search instead of text search (requires qmd)

## Instructions

1. If `--semantic` is specified, run: `snip search "<query>" --json`
   - This uses vector/semantic search via qmd
2. Otherwise, run: `snip find "<query>" --json`
   - Add filter flags if provided (--type, --tag, --lang)
3. Parse the JSON output and present results in a readable table format:
   - Name, title, language, tags
4. If no results found, suggest:
   - Broader search terms
   - Try semantic search if not already using it
   - Check available types/tags with `snip tags --json`

## Error Handling

- If query is empty, ask the user what they're looking for
- If qmd is not available for semantic search, fall back to `snip find`
