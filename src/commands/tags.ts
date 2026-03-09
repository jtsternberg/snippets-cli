import { Command } from "commander";
import { getAllSnippets } from "../lib/resolve.js";

export const tagsCommand = new Command("tags")
  .description("List all tags with counts")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const snippets = getAllSnippets();
    const tagCounts = new Map<string, number>();

    for (const s of snippets) {
      for (const tag of s.frontmatter.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    if (tagCounts.size === 0) {
      console.log("No tags found.");
      return;
    }

    // Sort by count descending
    const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

    if (opts.json) {
      console.log(
        JSON.stringify(
          Object.fromEntries(sorted),
          null,
          2,
        ),
      );
      return;
    }

    for (const [tag, count] of sorted) {
      console.log(`${tag} (${count})`);
    }
  });
