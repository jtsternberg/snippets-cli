import { Command } from "commander";
import { checkbox } from "@inquirer/prompts";
import { resolveSnippet, getFuzzyMatches, getAllSnippets } from "../lib/resolve.js";
import { parseSnippetFile, writeSnippetFile } from "../lib/frontmatter.js";
import { search as qmdSearch, ensureQmd } from "../lib/qmd.js";
import { existsSync } from "node:fs";
import { EXIT_CODES } from "../types/index.js";
import type { Snippet } from "../types/index.js";

export const linkCommand = new Command("link")
  .description("Find and add semantic cross-links to a snippet")
  .argument("<name>", "Snippet name or slug")
  .option("-n, --max <number>", "Maximum suggestions", "5")
  .option("--auto", "Automatically add all suggestions without prompting")
  .action(async (name: string, opts: { max?: string; auto?: boolean }) => {
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
    const maxResults = parseInt(opts.max || "5", 10);

    // Try qmd for semantic search
    let candidates: Snippet[] = [];
    const hasQmd = await ensureQmd();

    if (hasQmd) {
      const searchQuery = `${snippet.frontmatter.title} ${snippet.frontmatter.tags.join(" ")}`;
      const qmdResults = await qmdSearch(searchQuery, { maxResults: maxResults + 1 });

      for (const r of qmdResults) {
        if (existsSync(r.file) && r.file !== snippet.filePath) {
          try {
            candidates.push(parseSnippetFile(r.file));
          } catch {
            // Skip unparseable files
          }
        }
      }
    } else {
      // Fall back to tag-based similarity
      const allSnippets = getAllSnippets();
      candidates = allSnippets
        .filter((s) => s.filePath !== snippet.filePath)
        .filter((s) => {
          const sharedTags = s.frontmatter.tags.filter((t) =>
            snippet.frontmatter.tags.includes(t),
          );
          return sharedTags.length > 0;
        })
        .slice(0, maxResults);
    }

    if (candidates.length === 0) {
      console.log("No related snippets found.");
      return;
    }

    // Filter out already-linked snippets
    const existingLinks = new Set(
      snippet.frontmatter.related.map((r) => {
        const match = r.match(/\[\[(.+?)\]\]/);
        return match ? match[1] : r;
      }),
    );

    candidates = candidates.filter((c) => !existingLinks.has(c.slug));

    if (candidates.length === 0) {
      console.log("All related snippets are already linked.");
      return;
    }

    let selected: string[];

    if (opts.auto) {
      selected = candidates.map((c) => c.slug);
    } else {
      const choices = candidates.map((c) => ({
        name: `${c.slug} — ${c.frontmatter.title}`,
        value: c.slug,
      }));

      selected = await checkbox({
        message: "Select snippets to link:",
        choices,
      });
    }

    if (selected.length === 0) {
      console.log("No links added.");
      return;
    }

    // Add links to frontmatter
    const updated = parseSnippetFile(snippet.filePath);
    for (const slug of selected) {
      const wikilink = `[[${slug}]]`;
      if (!updated.frontmatter.related.includes(wikilink)) {
        updated.frontmatter.related.push(wikilink);
      }
    }

    writeSnippetFile(snippet.filePath, updated.frontmatter, updated.content);

    console.log(`Added ${selected.length} link(s) to ${snippet.slug}:`);
    for (const slug of selected) {
      console.log(`  [[${slug}]]`);
    }
  });
