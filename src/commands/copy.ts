import { Command } from "commander";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { extractCopyContent } from "../lib/frontmatter.js";
import { writeClipboard } from "../lib/clipboard.js";
import { EXIT_CODES } from "../types/index.js";

export const copyCommand = new Command("copy")
  .description("Copy snippet content to clipboard")
  .argument("<name>", "Snippet name or slug")
  .action(async (name: string) => {
    const result = resolveSnippet(name);

    if (!result) {
      const fuzzy = getFuzzyMatches(name);
      console.error(`Snippet "${name}" not found.`);
      if (fuzzy.length > 0) {
        console.error("\nDid you mean:");
        for (const s of fuzzy.slice(0, 5)) {
          console.error(`  ${s.slug} — ${s.frontmatter.title}`);
        }
      }
      process.exit(EXIT_CODES.NOT_FOUND);
    }

    const content = extractCopyContent(result.snippet);
    await writeClipboard(content);

    // Also write to stdout for piping
    process.stdout.write(content);

    console.error(`\nCopied to clipboard: ${result.snippet.frontmatter.title}`);
  });
