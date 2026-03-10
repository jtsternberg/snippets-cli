import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { search as qmdSearch, ensureQmd } from "../lib/qmd.js";
import { getAllSnippets } from "../lib/resolve.js";
import { extractCopyContent, parseSnippetFile } from "../lib/frontmatter.js";
import { writeClipboard } from "../lib/clipboard.js";
import { formatAlfredResults, formatAlfredError } from "../lib/alfred.js";
import { getLibraryPath } from "../lib/config.js";
import { existsSync } from "node:fs";
import type { Snippet } from "../types/index.js";
import { formatSnippetLine } from "../lib/format.js";

export const searchCommand = new Command("search")
  .description("Semantic search across snippets (via qmd)")
  .argument("<query>", "Search query")
  .option("--json", "Output Alfred-compatible JSON (non-interactive)")
  .option("-n, --max <number>", "Maximum results", "10")
  .option("--mode <mode>", "Search mode: query (hybrid), search (keyword), vsearch (vector)", "query")
  .action(async (query: string, opts) => {
    const libPath = getLibraryPath();
    if (!existsSync(libPath)) {
      if (opts.json) {
        console.log(JSON.stringify(formatAlfredError("Library not initialized. Run: snip init")));
      } else {
        console.error("Library not initialized. Run: snip init");
      }
      process.exit(3);
    }

    const maxResults = parseInt(opts.max, 10);
    let results: Snippet[] = [];

    // Try qmd first
    const hasQmd = await ensureQmd();
    if (hasQmd) {
      const qmdResults = await qmdSearch(query, {
        maxResults,
        mode: opts.mode,
      });

      // Map qmd results back to Snippet objects
      for (const r of qmdResults) {
        if (existsSync(r.file)) {
          try {
            results.push(parseSnippetFile(r.file));
          } catch {
            // Skip unparseable files
          }
        }
      }
    }

    // Fall back to text search if qmd unavailable or returned nothing
    if (results.length === 0) {
      const queryLower = query.toLowerCase();
      const allSnippets = getAllSnippets();
      results = allSnippets.filter((s) => {
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
    }

    if (results.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify(formatAlfredResults([])));
      } else {
        console.log(`No results for "${query}".`);
      }
      return;
    }

    // JSON mode for Alfred
    if (opts.json) {
      console.log(JSON.stringify(formatAlfredResults(results)));
      return;
    }

    // Interactive mode — let user select, then copy
    const choices = results.map((s) => ({
      name: formatSnippetLine(
        s.slug,
        s.frontmatter.title,
        s.frontmatter.language,
        s.frontmatter.tags,
      ),
      value: s.slug,
    }));

    const selected = await select({
      message: `${results.length} result(s) — select to copy:`,
      choices,
    });

    // Find the selected snippet and copy it
    const snippet = results.find((s) => s.slug === selected);
    if (snippet) {
      const content = extractCopyContent(snippet);
      await writeClipboard(content);
      process.stdout.write(content);
      console.error(`\nCopied to clipboard: ${snippet.frontmatter.title}`);
    }
  });
