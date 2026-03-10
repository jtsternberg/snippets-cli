import { Command } from "commander";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { extractCopyContent } from "../lib/frontmatter.js";
import { EXIT_CODES } from "../types/index.js";
import { highlight } from "cli-highlight";
import { fmt } from "../lib/format.js";

export const showCommand = new Command("show")
  .description("Display a snippet in the terminal")
  .argument("<name>", "Snippet name or slug")
  .option("--raw", "Output full file contents (frontmatter + body)")
  .option("--code", "Output only the code block content (no fences)")
  .action(async (name: string, opts: { raw?: boolean; code?: boolean }) => {
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

    // Code mode: output just the code block content (no fences, no header)
    if (opts.code) {
      process.stdout.write(extractCopyContent(snippet));
      return;
    }

    // Raw mode: output the full file contents as-is (pipeable)
    if (opts.raw) {
      const { readFileSync } = await import("node:fs");
      process.stdout.write(readFileSync(snippet.filePath, "utf-8"));
      return;
    }

    // Header
    console.log(fmt.bold(`# ${snippet.frontmatter.title}`));
    if (snippet.frontmatter.description) {
      console.log(snippet.frontmatter.description);
    }
    if (snippet.frontmatter.tags.length) {
      console.log(`${fmt.dim("Tags:")} ${fmt.cyan(snippet.frontmatter.tags.join(", "))}`);
    }
    if (snippet.frontmatter.aliases?.length) {
      console.log(`${fmt.dim("Aliases:")} ${snippet.frontmatter.aliases.join(", ")}`);
    }
    if (snippet.frontmatter.language) {
      console.log(`${fmt.dim("Language:")} ${snippet.frontmatter.language}`);
    }
    console.log(`${fmt.dim("Path:")} ${fmt.dim(snippet.filePath)}`);
    console.log("");

    // Content
    try {
      console.log(highlight(snippet.body, { language: "markdown" }));
    } catch {
      console.log(snippet.body);
    }
  });
