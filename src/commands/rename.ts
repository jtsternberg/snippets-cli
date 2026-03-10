import { Command } from "commander";
import { renameSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { resolveSnippet, getFuzzyMatches, getAllSnippets } from "../lib/resolve.js";
import { parseSnippetFile, writeSnippetFile } from "../lib/frontmatter.js";
import { slugify } from "../lib/slug.js";
import { loadConfig } from "../lib/config.js";
import { EXIT_CODES } from "../types/index.js";

export const renameCommand = new Command("rename")
  .description("Rename a snippet and update cross-links")
  .argument("<old-name>", "Current snippet name or slug")
  .argument("<new-title>", "New title for the snippet")
  .action(async (oldName: string, newTitle: string) => {
    const result = resolveSnippet(oldName);

    if (!result) {
      const fuzzy = getFuzzyMatches(oldName);
      console.error(`Snippet "${oldName}" not found.`);
      if (fuzzy.length > 0) {
        console.error("\nDid you mean:");
        for (const s of fuzzy.slice(0, 5)) {
          console.error(`  ${s.slug} — ${s.frontmatter.title}`);
        }
      }
      process.exit(EXIT_CODES.NOT_FOUND);
    }

    const { snippet } = result;
    const oldSlug = snippet.slug;
    // Strip type prefix (e.g. "snippets/new-name" → "new-name") but preserve
    // legitimate slashes in titles (e.g. "HTTP/2 Client")
    const config = loadConfig();
    const slashIdx = newTitle.indexOf("/");
    const maybeType = slashIdx > 0 ? newTitle.slice(0, slashIdx) : "";
    const newName = config.types.includes(maybeType) ? newTitle.slice(slashIdx + 1) : newTitle;
    const newSlug = slugify(newName);
    const dir = dirname(snippet.filePath);
    const newPath = resolve(dir, `${newSlug}.md`);

    // Update frontmatter with new title
    const updated = parseSnippetFile(snippet.filePath);
    updated.frontmatter.title = newName;
    writeSnippetFile(snippet.filePath, updated.frontmatter, updated.content);

    // Rename the file
    renameSync(snippet.filePath, newPath);

    // Update wikilinks in other snippets
    const allSnippets = getAllSnippets();
    let updatedCount = 0;

    for (const s of allSnippets) {
      if (s.filePath === snippet.filePath || s.filePath === newPath) continue;

      const raw = readFileSync(s.filePath, "utf-8");
      if (raw.includes(`[[${oldSlug}]]`)) {
        const updated = raw.replace(
          new RegExp(`\\[\\[${oldSlug}\\]\\]`, "g"),
          `[[${newSlug}]]`,
        );
        writeFileSync(s.filePath, updated, "utf-8");
        updatedCount++;
      }
    }

    console.log(`Renamed: ${oldSlug} → ${newSlug}`);
    console.log(`  File: ${newPath}`);
    if (updatedCount > 0) {
      console.log(`  Updated ${updatedCount} cross-link(s)`);
    }
  });
