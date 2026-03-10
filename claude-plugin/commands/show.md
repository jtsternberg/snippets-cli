# Show a Snippet

Display a snippet's content by name.

## Usage

/snippets-cli:show <name> [--raw] [--code]

## Arguments

- `name` (required) - Snippet name or slug
- `--raw` - Show full file with frontmatter + body
- `--code` - Show only code block content (no fences or metadata)

## Instructions

1. Run: `snip show <name>` with any flags provided (--raw, --code)
2. Display the output to the user
3. If the snippet is not found:
   - Run `snip find "<name>" --json` to suggest similar snippets
   - Present matches and ask if the user meant one of them

## Error Handling

- If name is empty, run `snip list --json` and ask the user to pick one
- If snippet not found, search for similar names and suggest alternatives
