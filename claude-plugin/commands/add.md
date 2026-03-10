# Add a Snippet

Add a new snippet to the library, optionally from clipboard or inline content.

## Usage

/snippets-cli:add [--type=<type>] [--lang=<language>] [--tags=<tags>] [--title=<title>] [--from-clipboard] [--content=<content>]

## Arguments

All arguments are optional:
- `--type` - Snippet type/directory (e.g., shell, python, docker)
- `--lang` - Programming language for syntax highlighting
- `--tags` - Comma-separated tags
- `--title` - Snippet title
- `--from-clipboard` - Create from clipboard content
- `--content` - Inline snippet content (for non-interactive use)

## Instructions

1. If `--from-clipboard` is specified, run: `snip add --from-clipboard`
   - Add any additional flags provided (--type, --lang, --tags, --title)
2. If `--content` is specified, run: `snip add --content "<content>"`
   - Add any additional flags provided
3. If no content source specified, ask the user what they want to save as a snippet
4. After creation, run `snip list --json | head -1` to confirm the snippet was added
5. Report the snippet name and location

## Error Handling

- If snip is not installed, suggest: `npm i -g snippets-cli`
- If no library exists, suggest: `snip init`
- If clipboard is empty when using --from-clipboard, inform the user
