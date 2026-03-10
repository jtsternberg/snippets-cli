import { Command } from "commander";
import { resolve, basename, extname } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { glob } from "glob";
import { getLibraryPath, loadConfig } from "../lib/config.js";
import {
  createNewFrontmatter,
  writeSnippetFile,
  parseSnippetString,
} from "../lib/frontmatter.js";
import { uniqueSlug } from "../lib/slug.js";
import { EXIT_CODES } from "../types/index.js";
import { updateAndEmbed } from "../lib/qmd.js";
import { enrichSnippet } from "../lib/llm.js";
import { requireGh, parseGistId, fetchGist } from "../lib/gist.js";

// Map file extensions to language names
const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "zsh",
  ".fish": "fish",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".pl": "perl",
  ".lua": "lua",
  ".r": "r",
  ".sql": "sql",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".md": "markdown",
};

async function fetchUrl(url: string): Promise<string> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
  }
  return resp.text();
}

async function importSingleFile(
  source: string,
  opts: { type?: string; tags?: string[]; enrich: boolean },
): Promise<string | null> {
  const config = loadConfig();
  const libPath = getLibraryPath(config);

  let content: string;
  let title: string;
  let language = "";
  let isMarkdown = false;
  let sourceRef = "";

  // Determine source type
  if (source.startsWith("http://") || source.startsWith("https://")) {
    sourceRef = source;
    content = await fetchUrl(source);
    // Derive title from URL
    const urlPath = new URL(source).pathname;
    title = basename(urlPath, extname(urlPath)) || "imported";
    const ext = extname(urlPath).toLowerCase();
    language = EXT_TO_LANG[ext] || "";
    isMarkdown = ext === ".md";
  } else {
    // Local file
    const filePath = resolve(source);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null;
    }
    content = readFileSync(filePath, "utf-8");
    const ext = extname(filePath).toLowerCase();
    title = basename(filePath, ext);
    language = EXT_TO_LANG[ext] || "";
    isMarkdown = ext === ".md";
    sourceRef = filePath;
  }

  // Determine type directory
  const type = opts.type || (language === "prompt" ? "prompts" : config.defaultType);
  const typeDir = resolve(libPath, type);
  mkdirSync(typeDir, { recursive: true });

  // If it's already a markdown file with frontmatter, adopt it
  if (isMarkdown && content.startsWith("---")) {
    const parsed = parseSnippetString(content, "temp.md");
    const slug = uniqueSlug(parsed.frontmatter.title || title, typeDir);
    const outPath = resolve(typeDir, `${slug}.md`);

    const fm = createNewFrontmatter({
      ...parsed.frontmatter,
      type,
      source: sourceRef || parsed.frontmatter.source,
    });

    if (opts.tags?.length) {
      fm.tags = [...new Set([...fm.tags, ...opts.tags])];
    }

    writeSnippetFile(outPath, fm, parsed.content);
    return outPath;
  }

  // Raw file — wrap in frontmatter with code fence
  const slug = uniqueSlug(title, typeDir);
  const outPath = resolve(typeDir, `${slug}.md`);
  const tags = opts.tags || [];

  const fm = createNewFrontmatter({
    title,
    language,
    tags,
    type,
    source: sourceRef,
  });

  const fencedContent = language
    ? `\n\`\`\`${language}\n${content}\n\`\`\`\n`
    : `\n\`\`\`\n${content}\n\`\`\`\n`;

  writeSnippetFile(outPath, fm, fencedContent);

  // LLM enrichment
  if (opts.enrich) {
    const snippet = parseSnippetString(
      readFileSync(outPath, "utf-8"),
      outPath,
    );
    const enriched = await enrichSnippet(snippet.frontmatter, fencedContent);
    if (Object.keys(enriched).length > 0) {
      const updatedFm = { ...snippet.frontmatter, ...enriched };
      writeSnippetFile(outPath, updatedFm, snippet.content);
    }
  }

  return outPath;
}

export const importCommand = new Command("import")
  .description("Import snippets from files, globs, URLs, or GitHub Gists")
  .argument("[sources...]", "Files, glob patterns, or URLs to import")
  .option("-t, --type <type>", "Target snippet type (directory)")
  .option("--tags <tags>", "Comma-separated tags to add")
  .option("--no-enrich", "Skip LLM enrichment")
  .option("--from-gist <url-or-id>", "Import all files from a GitHub Gist")
  .action(async (sources: string[], opts) => {
    if (opts.fromGist) {
      return importFromGist(opts);
    }

    if (!sources || sources.length === 0) {
      console.error("No sources specified. Provide files, URLs, or use --from-gist.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    const config = loadConfig();
    const libPath = getLibraryPath(config);

    if (!existsSync(libPath)) {
      console.error("Snippet library not initialized. Run `snip init` first.");
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    const tags = opts.tags
      ? opts.tags.split(",").map((t: string) => t.trim())
      : [];

    let imported = 0;
    let failed = 0;

    for (const source of sources) {
      // Check if it's a URL
      if (source.startsWith("http://") || source.startsWith("https://")) {
        try {
          const outPath = await importSingleFile(source, {
            type: opts.type,
            tags,
            enrich: opts.enrich !== false,
          });
          if (outPath) {
            console.log(`  Imported: ${outPath}`);
            imported++;
          } else {
            failed++;
          }
        } catch (err) {
          console.error(`  Failed: ${source} — ${err instanceof Error ? err.message : err}`);
          failed++;
        }
        continue;
      }

      // Expand globs
      const files = await glob(source, { absolute: true, nodir: true });
      if (files.length === 0) {
        // Maybe it's a literal file path
        if (existsSync(resolve(source))) {
          files.push(resolve(source));
        } else {
          console.error(`  No matches: ${source}`);
          failed++;
          continue;
        }
      }

      for (const file of files) {
        // Skip files already in the library
        if (file.startsWith(libPath)) {
          console.error(`  Skipped (already in library): ${file}`);
          continue;
        }

        try {
          const outPath = await importSingleFile(file, {
            type: opts.type,
            tags,
            enrich: opts.enrich !== false,
          });
          if (outPath) {
            console.log(`  Imported: ${outPath}`);
            imported++;
          } else {
            failed++;
          }
        } catch (err) {
          console.error(`  Failed: ${file} — ${err instanceof Error ? err.message : err}`);
          failed++;
        }
      }
    }

    console.log(`\n${imported} imported, ${failed} failed.`);

    if (imported > 0) {
      await updateAndEmbed();
    }
  });

// Map gist language names (from GitHub API) to our language identifiers
const GIST_LANG_MAP: Record<string, string> = {
  javascript: "javascript", typescript: "typescript", python: "python",
  ruby: "ruby", shell: "bash", bash: "bash", zsh: "zsh", go: "go",
  rust: "rust", java: "java", kotlin: "kotlin", swift: "swift",
  c: "c", "c++": "cpp", "c#": "csharp", php: "php", perl: "perl",
  lua: "lua", r: "r", sql: "sql", html: "html", css: "css",
  scss: "scss", json: "json", yaml: "yaml", toml: "toml", xml: "xml",
  markdown: "markdown",
};

async function importFromGist(opts: {
  fromGist: string;
  type?: string;
  tags?: string;
  enrich: boolean;
}): Promise<void> {
  requireGh();

  const config = loadConfig();
  const libPath = getLibraryPath(config);

  if (!existsSync(libPath)) {
    console.error("Snippet library not initialized. Run `snip init` first.");
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const gistId = parseGistId(opts.fromGist);
  const gist = fetchGist(gistId);
  // Use the gist's last-updated date as the sync baseline
  const gistUpdated = gist.updatedAt
    ? gist.updatedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  if (gist.files.length === 0) {
    console.error("Gist has no files.");
    process.exit(EXIT_CODES.NOT_FOUND);
  }

  const tags = opts.tags
    ? opts.tags.split(",").map((t: string) => t.trim())
    : [];
  // Add "gist" tag so imports are discoverable
  if (!tags.includes("gist")) tags.push("gist");

  const type = opts.type || config.defaultType;
  const typeDir = resolve(libPath, type);
  mkdirSync(typeDir, { recursive: true });

  let imported = 0;

  for (const file of gist.files) {
    const ext = extname(file.filename).toLowerCase();
    const title = basename(file.filename, ext);
    const language = GIST_LANG_MAP[file.language] || EXT_TO_LANG[ext] || "";

    const slug = uniqueSlug(title, typeDir);
    const outPath = resolve(typeDir, `${slug}.md`);

    // If it's already a markdown snippet file, adopt it
    if (ext === ".md" && file.content.startsWith("---")) {
      const parsed = parseSnippetString(file.content, "temp.md");
      const fm = createNewFrontmatter({
        ...parsed.frontmatter,
        type,
        gist_id: gistId,
        gist_updated: gistUpdated,
        source: `https://gist.github.com/${gistId}`,
      });
      fm.tags = [...new Set([...fm.tags, ...tags])];
      writeSnippetFile(outPath, fm, parsed.content);
    } else {
      // Wrap raw content in a code fence
      const fencedContent = language
        ? `\n\`\`\`${language}\n${file.content}\n\`\`\`\n`
        : `\n\`\`\`\n${file.content}\n\`\`\`\n`;

      const fm = createNewFrontmatter({
        title,
        language,
        tags,
        type,
        gist_id: gistId,
        gist_updated: gistUpdated,
        source: `https://gist.github.com/${gistId}`,
      });

      writeSnippetFile(outPath, fm, fencedContent);

      // LLM enrichment
      if (opts.enrich !== false) {
        try {
          const snippet = parseSnippetString(readFileSync(outPath, "utf-8"), outPath);
          const enriched = await enrichSnippet(snippet.frontmatter, fencedContent);
          if (Object.keys(enriched).length > 0) {
            writeSnippetFile(outPath, { ...snippet.frontmatter, ...enriched }, snippet.content);
          }
        } catch {
          // Enrichment failure is non-fatal
        }
      }
    }

    console.log(`  Imported: ${slug} (from ${file.filename})`);
    imported++;
  }

  console.log(`\n${imported} file(s) imported from gist ${gistId}`);

  if (imported > 0) {
    await updateAndEmbed();
  }
}
