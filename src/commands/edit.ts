import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { parseSnippetFile, writeSnippetFile } from "../lib/frontmatter.js";
import { loadConfig } from "../lib/config.js";
import { EXIT_CODES } from "../types/index.js";
import { updateAndEmbed } from "../lib/qmd.js";

export const editCommand = new Command("edit")
  .description("Open a snippet in your editor")
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

    const config = loadConfig();
    const editor = config.editor || process.env.EDITOR || "vi";
    const filePath = result.snippet.filePath;

    const child = spawnSync(editor, [filePath], {
      stdio: "inherit",
    });

    if (child.status !== 0) {
      console.error("Editor exited with error.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    // Update modified timestamp
    const updated = parseSnippetFile(filePath);
    writeSnippetFile(filePath, updated.frontmatter, updated.content);

    console.log(`Updated: ${filePath}`);

    // qmd post-hook: re-index
    await updateAndEmbed();
  });
