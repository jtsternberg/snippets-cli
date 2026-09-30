import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { search as qmdSearch, ensureQmd } from "../lib/qmd.js";
import { getAllSnippets } from "../lib/resolve.js";
import { extractCopyContent, parseSnippetFile } from "../lib/frontmatter.js";
import { writeClipboard } from "../lib/clipboard.js";
import { formatAlfredResults, formatAlfredError } from "../lib/alfred.js";
import { assertLibraryExists, getLibraryPath } from "../lib/config.js";
import { existsSync } from "node:fs";
import type { Snippet } from "../types/index.js";
import { formatSnippetLine } from "../lib/format.js";
import { textSearch } from "../lib/text-search.js";

export const searchCommand = new Command("search")
  .description("Fast keyword search across snippets (--semantic for qmd)")
  .argument("<query>", "Search query")
  .option("--json", "Output Alfred-compatible JSON (non-interactive)")
  .option("-n, --max <number>", "Maximum results", "10")
  .option("-s, --semantic", "Semantic search via qmd (slower)")
  .option("--mode <mode>", "qmd search mode, implies --semantic: query (hybrid), search (keyword), vsearch (vector)")
  .action(async (query: string, opts) => {
    const libPath = getLibraryPath();
    assertLibraryExists(libPath);

    const maxResults = parseInt(opts.max, 10);
    let results: Snippet[] = [];

    if (opts.semantic || opts.mode) {
      const hasQmd = await ensureQmd();
      if (hasQmd) {
        const qmdResults = await qmdSearch(query, {
          maxResults,
          mode: opts.mode ?? "query",
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
    }

    // Keyword search is the default, and the fallback when qmd is unavailable or returns nothing
    if (results.length === 0) {
      results = textSearch(getAllSnippets(), query).slice(0, maxResults);
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
