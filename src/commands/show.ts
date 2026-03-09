import { Command } from "commander";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { EXIT_CODES } from "../types/index.js";
import { highlight } from "cli-highlight";

export const showCommand = new Command("show")
  .description("Display a snippet in the terminal")
  .argument("<name>", "Snippet name or slug")
  .option("--raw", "Show raw markdown without highlighting")
  .action(async (name: string, opts: { raw?: boolean }) => {
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

    const { snippet } = result;

    // Header
    console.log(`# ${snippet.frontmatter.title}`);
    if (snippet.frontmatter.tags.length) {
      console.log(`Tags: ${snippet.frontmatter.tags.join(", ")}`);
    }
    if (snippet.frontmatter.language) {
      console.log(`Language: ${snippet.frontmatter.language}`);
    }
    console.log(`Path: ${snippet.filePath}`);
    console.log("");

    // Content
    if (opts.raw) {
      console.log(snippet.body);
    } else {
      try {
        console.log(highlight(snippet.body, { language: "markdown" }));
      } catch {
        console.log(snippet.body);
      }
    }
  });
