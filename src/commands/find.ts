import { Command } from "commander";
import { getAllSnippets } from "../lib/resolve.js";
import { formatSnippetLine, formatCount, fmt } from "../lib/format.js";

export const findCommand = new Command("find")
  .description("Quick text search across snippets (grep-like)")
  .argument("<query>", "Search text")
  .option("-t, --type <type>", "Filter by type")
  .option("--tag <tag>", "Filter by tag")
  .option("-l, --lang <language>", "Filter by language")
  .option("--json", "Output as JSON")
  .action(async (query: string, opts) => {
    const queryLower = query.toLowerCase();
    let snippets = getAllSnippets();

    // Apply pre-filters
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
        (s) => s.frontmatter.language.toLowerCase() === opts.lang.toLowerCase(),
      );
    }

    // Search across slug, title, tags, content
    const matches = snippets.filter((s) => {
      const searchable = [
        s.slug,
        s.frontmatter.title,
        ...s.frontmatter.tags,
        s.frontmatter.language,
        s.body,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(queryLower);
    });

    if (matches.length === 0) {
      console.log(`No results for "${query}".`);
      return;
    }

    if (opts.json) {
      console.log(
        JSON.stringify(
          matches.map((s) => ({
            slug: s.slug,
            title: s.frontmatter.title,
            type: s.frontmatter.type,
            language: s.frontmatter.language,
            tags: s.frontmatter.tags,
            path: s.filePath,
          })),
          null,
          2,
        ),
      );
      return;
    }

    for (const s of matches) {
      console.log(formatSnippetLine(
        s.slug,
        s.frontmatter.title,
        s.frontmatter.language,
        s.frontmatter.tags,
      ));

      // Show matching line preview
      const lines = s.body.split("\n");
      for (const line of lines) {
        if (line.toLowerCase().includes(queryLower) && line.trim()) {
          const trimmed =
            line.trim().length > 80
              ? line.trim().slice(0, 80) + "..."
              : line.trim();
          console.log(`  ${fmt.dim(">")} ${fmt.dim(trimmed)}`);
          break;
        }
      }
    }

    console.log(`\n${formatCount(matches.length, "result")}`);
  });
