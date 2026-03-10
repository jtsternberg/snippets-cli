import { Command } from "commander";
import { resolveSnippet, getAllSnippets, getFuzzyMatches } from "../lib/resolve.js";
import { EXIT_CODES } from "../types/index.js";
import { readFileSync, writeFileSync } from "node:fs";

export const exportCommand = new Command("export")
  .description("Export snippets to JSON or Markdown")
  .argument("[name]", "Snippet name or slug to export")
  .option("-f, --format <format>", "Output format: json or md", "json")
  .option("-t, --type <type>", "Filter by type")
  .option("--tag <tag>", "Filter by tag")
  .option("--to-gist", "Export to GitHub Gist (coming soon)")
  .option("-o, --output <path>", "Write to file instead of stdout")
  .action(async (name: string | undefined, opts: {
    format: string;
    type?: string;
    tag?: string;
    toGist?: boolean;
    output?: string;
  }) => {
    // Gist stub
    if (opts.toGist) {
      console.error("Gist export coming in Phase 6.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    let snippetsToExport: ReturnType<typeof getAllSnippets>;

    if (name) {
      // Single snippet export
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

      snippetsToExport = [result.snippet];
    } else {
      // All snippets with optional filters
      snippetsToExport = getAllSnippets();

      if (opts.type) {
        snippetsToExport = snippetsToExport.filter(
          (s) => s.frontmatter.type === opts.type,
        );
      }

      if (opts.tag) {
        snippetsToExport = snippetsToExport.filter((s) =>
          s.frontmatter.tags.some(
            (t) => t.toLowerCase() === opts.tag!.toLowerCase(),
          ),
        );
      }
    }

    let output: string;

    if (opts.format === "md") {
      // Markdown: raw file contents
      output = snippetsToExport
        .map((s) => readFileSync(s.filePath, "utf-8"))
        .join("\n---\n\n");
    } else {
      // JSON: structured export
      const data = snippetsToExport.map((s) => ({
        slug: s.slug,
        title: s.frontmatter.title,
        description: s.frontmatter.description,
        tags: s.frontmatter.tags,
        aliases: s.frontmatter.aliases,
        language: s.frontmatter.language,
        type: s.frontmatter.type,
        date: s.frontmatter.date,
        modified: s.frontmatter.modified,
        source: s.frontmatter.source,
        related: s.frontmatter.related,
        content: s.body,
      }));
      output = JSON.stringify(data, null, 2);
    }

    if (opts.output) {
      writeFileSync(opts.output, output, "utf-8");
      console.error(`Exported ${snippetsToExport.length} snippet(s) to ${opts.output}`);
    } else {
      process.stdout.write(output);
    }
  });
