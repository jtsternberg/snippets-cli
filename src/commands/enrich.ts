import { Command } from "commander";
import { renameSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { resolveSnippet, getAllSnippets, getFuzzyMatches } from "../lib/resolve.js";

import { writeSnippetFile } from "../lib/frontmatter.js";
import { enrichSnippet, isLlmAvailable, setProviderOverride, setDebugMode, isValidProvider } from "../lib/llm.js";
import { loadConfig, getLibraryPath } from "../lib/config.js";
import { EXIT_CODES } from "../types/index.js";
import type { Snippet, SnippetFrontmatter } from "../types/index.js";
import { fmt } from "../lib/format.js";
import ora from "ora";

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
      if (!isValidProvider(opts.provider)) {
        console.error(`Invalid provider "${opts.provider}". Use: ollama, gemini, gemini-cli, claude, claude-cli, openai, openai-cli, auto`);
        process.exit(EXIT_CODES.CONFIG_ERROR);
      }
      setProviderOverride(opts.provider);
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

  const spinner = ora(`Enriching ${result.snippet.slug}…`).start();
  const enrichResult = await applyEnrichment(result.snippet, opts);
  spinner.stop();
  if (enrichResult) {
    console.log(`${fmt.green("Enriched:")} ${result.snippet.slug}`);
    printUpdates(enrichResult.updates);
    if (enrichResult.movedTo) {
      console.log(`  ${fmt.dim("Moved to:")} ${enrichResult.movedTo}`);
    }
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
    const spinner = ora(`Enriching ${snippet.slug}…`).start();
    const enrichResult = await applyEnrichment(snippet, opts);
    spinner.stop();
    if (enrichResult) {
      enriched++;
      console.log(`  ${fmt.green("Updated:")} ${snippet.slug}`);
      printUpdates(enrichResult.updates, "    ");
      if (enrichResult.movedTo) {
        console.log(`    ${fmt.dim("Moved to:")} ${enrichResult.movedTo}`);
      }
    }
  }

  console.log(`\nDone. ${enriched}/${snippets.length} snippet(s) updated.`);
}

interface EnrichResult {
  updates: Partial<SnippetFrontmatter>;
  movedTo?: string;
}

async function applyEnrichment(
  snippet: Snippet,
  opts: { force?: boolean; dryRun?: boolean },
): Promise<EnrichResult | null> {
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
  if (Object.keys(updates).length === 0) return null;

  if (opts.dryRun) {
    console.log(`  Would update ${snippet.slug}:`, JSON.stringify(updates));
    return { updates };
  }

  const updatedFm = { ...snippet.frontmatter, ...updates };

  // Update code fence language if language changed
  let content = snippet.content;
  if (updates.language) {
    const oldLang = snippet.frontmatter.language || "";
    const newLang = updates.language;
    if (oldLang !== newLang) {
      // Replace existing fence language or add to bare fences
      content = content.replace(/```\w*/g, (match) => {
        if (match === "```" || match === `\`\`\`${oldLang}`) {
          return `\`\`\`${newLang}`;
        }
        return match;
      });
    }
  }

  // Move file if language is "prompt" and not already in prompts/
  let filePath = snippet.filePath;
  const config = loadConfig();
  if (
    updatedFm.language === "prompt" &&
    updatedFm.type !== "prompts" &&
    config.types.includes("prompts")
  ) {
    updatedFm.type = "prompts";
    const libPath = getLibraryPath();
    const promptsDir = resolve(libPath, "prompts");
    mkdirSync(promptsDir, { recursive: true });
    const newPath = resolve(promptsDir, `${snippet.slug}.md`);
    writeSnippetFile(filePath, updatedFm, content);
    renameSync(filePath, newPath);
    return { updates, movedTo: newPath };
  }

  writeSnippetFile(filePath, updatedFm, content);
  return { updates };
}

function printUpdates(updates: Partial<SnippetFrontmatter>, indent = "  "): void {
  if (updates.title) console.log(`${indent}${fmt.dim("Title:")} ${updates.title}`);
  if (updates.description) console.log(`${indent}${fmt.dim("Description:")} ${updates.description}`);
  if (updates.language) console.log(`${indent}${fmt.dim("Language:")} ${updates.language}`);
  if (updates.tags?.length) console.log(`${indent}${fmt.dim("Tags:")} ${updates.tags.join(", ")}`);
  if (updates.aliases?.length) console.log(`${indent}${fmt.dim("Aliases:")} ${updates.aliases.join(", ")}`);
}
