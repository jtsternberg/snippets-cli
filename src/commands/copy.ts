import { Command } from "commander";
import { resolveSnippetLoose, exitIfNotFound } from "../lib/resolve.js";
import { extractCopyContent } from "../lib/frontmatter.js";
import { writeClipboard } from "../lib/clipboard.js";

export const copyCommand = new Command("copy")
  .description("Copy snippet content to clipboard")
  .argument("<name>", "Snippet name or slug")
  .action(async (name: string) => {
    const result = resolveSnippetLoose(name);

    exitIfNotFound(result, name);

    const content = extractCopyContent(result.snippet);
    await writeClipboard(content);

    // Also write to stdout for piping
    process.stdout.write(content);

    console.error(`\nCopied to clipboard: ${result.snippet.frontmatter.title}`);
  });
