import { Command } from "commander";
import { resolveSnippet, getAllSnippets, getFuzzyMatches } from "../lib/resolve.js";

import { writeSnippetFile } from "../lib/frontmatter.js";
import { enrichSnippet, isLlmAvailable, setProviderOverride, setDebugMode } from "../lib/llm.js";
import { EXIT_CODES } from "../types/index.js";
import type { Snippet, LlmProviderName } from "../types/index.js";

export const enrichCommand = new Command("enrich")
  .description("Re-run LLM enrichment on snippets to fill missing metadata")
  .argument("[name]", "Snippet name to enrich (omit for --all)")
  .option("--all", "Enrich all snippets with missing metadata")
  .option("--force", "Overwrite existing metadata fields")
  .option("--type <type>", "Filter by snippet type (with --all)")
  .option("--dry-run", "Show what would be updated without writing")
  .option("--provider <provider>", "LLM provider override (ollama, gemini, claude, openai, auto)")
  .option("--debug", "Log LLM provider commands and responses")
  .action(async (name: string | undefined, opts: {
    all?: boolean;
    force?: boolean;
    type?: string;
    dryRun?: boolean;
    provider?: string;
    debug?: boolean;
  }) => {
    if (opts.debug) setDebugMode(true);
    if (opts.provider) {
      setProviderOverride(opts.provider as LlmProviderName);
    }
    if (!(await isLlmAvailable())) {
      console.error("No LLM provider available. Configure one with `snip config:llm:provider` or start Ollama.");
      process.exit(EXIT_CODES.EXTERNAL_TOOL_ERROR);
    }

    if (!name && !opts.all) {
      console.error("Specify a snippet name or use --all to enrich all snippets.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    if (name) {
      await enrichSingle(name, opts);
    } else {
      await enrichAll(opts);
    }
  });

async function enrichSingle(
  name: string,
  opts: { force?: boolean; dryRun?: boolean },
): Promise<void> {
  const result = resolveSnippet(name);
  if (!result) {
    const fuzzy = getFuzzyMatches(name);
    if (fuzzy.length > 0) {
      console.error(`Snippet "${name}" not found. Did you mean: ${fuzzy.map((s) => s.slug).join(", ")}?`);
    } else {
      console.error(`Snippet "${name}" not found.`);
    }
    process.exit(EXIT_CODES.NOT_FOUND);
  }

  const updated = await applyEnrichment(result.snippet, opts);
  if (updated) {
    console.log(`Enriched: ${result.snippet.slug}`);
  } else {
    console.log(`No updates needed for: ${result.snippet.slug}`);
  }
}

async function enrichAll(
  opts: { force?: boolean; type?: string; dryRun?: boolean },
): Promise<void> {
  let snippets = getAllSnippets();
  if (opts.type) {
    snippets = snippets.filter((s) => s.frontmatter.type === opts.type);
  }

  if (snippets.length === 0) {
    console.log("No snippets found.");
    return;
  }

  console.log(`Enriching ${snippets.length} snippet(s)...`);
  let enriched = 0;

  for (const snippet of snippets) {
    const updated = await applyEnrichment(snippet, opts);
    if (updated) {
      enriched++;
      console.log(`  Updated: ${snippet.slug}`);
    }
  }

  console.log(`\nDone. ${enriched}/${snippets.length} snippet(s) updated.`);
}

async function applyEnrichment(
  snippet: Snippet,
  opts: { force?: boolean; dryRun?: boolean },
): Promise<boolean> {
  // If --force, blank out fields so enrichSnippet will regenerate them
  const frontmatter = opts.force
    ? {
        ...snippet.frontmatter,
        title: "",
        description: "",
        language: "",
        aliases: [],
        tags: [],
      }
    : snippet.frontmatter;

  const updates = await enrichSnippet(frontmatter, snippet.body);
  if (Object.keys(updates).length === 0) return false;

  if (opts.dryRun) {
    console.log(`  Would update ${snippet.slug}:`, JSON.stringify(updates));
    return true;
  }

  const updatedFm = { ...snippet.frontmatter, ...updates };
  writeSnippetFile(snippet.filePath, updatedFm, snippet.content);
  return true;
}
