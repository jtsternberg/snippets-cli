import { Command } from "commander";
import { getAllSnippets } from "../lib/resolve.js";
import { formatSnippetLine, formatCount } from "../lib/format.js";

export const listCommand = new Command("list")
  .description("List snippets with optional filters")
  .option("-t, --type <type>", "Filter by type (directory)")
  .option("--tag <tag>", "Filter by tag")
  .option("-l, --lang <language>", "Filter by language")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    let snippets = getAllSnippets();

    if (snippets.length === 0) {
      console.log("No snippets found. Add one with `snip add`.");
      return;
    }

    // Apply filters
    if (opts.type) {
      snippets = snippets.filter((s) => s.frontmatter.type === opts.type);
    }

    if (opts.tag) {
      snippets = snippets.filter((s) =>
        s.frontmatter.tags.some(
          (t) => t.toLowerCase() === opts.tag.toLowerCase(),
        ),
      );
    }

    if (opts.lang) {
      snippets = snippets.filter(
        (s) =>
          s.frontmatter.language.toLowerCase() === opts.lang.toLowerCase(),
      );
    }

    // Sort by modified date descending
    snippets.sort((a, b) =>
      (b.frontmatter.modified || b.frontmatter.date).localeCompare(
        a.frontmatter.modified || a.frontmatter.date,
      ),
    );

    if (opts.json) {
      console.log(
        JSON.stringify(
          snippets.map((s) => ({
            slug: s.slug,
            title: s.frontmatter.title,
            type: s.frontmatter.type,
            language: s.frontmatter.language,
            tags: s.frontmatter.tags,
            modified: s.frontmatter.modified,
            path: s.filePath,
          })),
          null,
          2,
        ),
      );
      return;
    }

    // Table-like output
    for (const s of snippets) {
      console.log(formatSnippetLine(
        s.slug,
        s.frontmatter.title,
        s.frontmatter.language,
        s.frontmatter.tags,
      ));
    }

    console.log(`\n${formatCount(snippets.length, "snippet")}`);
  });
