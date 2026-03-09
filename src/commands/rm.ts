import { Command } from "commander";
import { unlinkSync } from "node:fs";
import { confirm } from "@inquirer/prompts";
import { resolveSnippet, getFuzzyMatches, getAllSnippets } from "../lib/resolve.js";
import { EXIT_CODES } from "../types/index.js";
import { update as qmdUpdate } from "../lib/qmd.js";

export const rmCommand = new Command("rm")
  .description("Delete a snippet")
  .argument("<name>", "Snippet name or slug")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (name: string, opts: { force?: boolean }) => {
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

    if (!opts.force) {
      const ok = await confirm({
        message: `Delete "${snippet.frontmatter.title}" (${snippet.filePath})?`,
      });
      if (!ok) {
        console.log("Cancelled.");
        return;
      }
    }

    // Check for cross-links pointing to this snippet
    const allSnippets = getAllSnippets();
    const linkers = allSnippets.filter(
      (s) =>
        s.filePath !== snippet.filePath &&
        s.frontmatter.related.some((r) => r.includes(snippet.slug)),
    );

    unlinkSync(snippet.filePath);
    console.log(`Deleted: ${snippet.filePath}`);

    if (linkers.length > 0) {
      console.log(`\nWarning: These snippets reference "${snippet.slug}":`);
      for (const l of linkers) {
        console.log(`  ${l.slug} — ${l.frontmatter.title}`);
      }
      console.log("Consider updating their cross-links.");
    }

    // qmd post-hook: update index
    await qmdUpdate();
  });
