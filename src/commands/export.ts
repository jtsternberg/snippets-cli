import { Command } from "commander";
import { resolveSnippet, getAllSnippets, getFuzzyMatches } from "../lib/resolve.js";
import { EXIT_CODES, type Snippet } from "../types/index.js";
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { writeSnippetFile } from "../lib/frontmatter.js";
import { requireGh } from "../lib/gist.js";
import { tmpdir } from "node:os";
import { resolve as resolvePath } from "node:path";

export const exportCommand = new Command("export")
  .description("Export snippets to JSON or Markdown")
  .argument("[name]", "Snippet name or slug to export")
  .option("-f, --format <format>", "Output format: json or md", "json")
  .option("-t, --type <type>", "Filter by type")
  .option("--tag <tag>", "Filter by tag")
  .option("--to-gist", "Publish snippet(s) as a GitHub Gist")
  .option("--public", "Create a public gist (default: secret)")
  .option("-o, --output <path>", "Write to file instead of stdout")
  .action(async (name: string | undefined, opts: {
    format: string;
    type?: string;
    tag?: string;
    toGist?: boolean;
    public?: boolean;
    output?: string;
  }) => {
    if (opts.toGist) {
      return exportToGist(name, opts);
    }

    let snippetsToExport = resolveSnippetsToExport(name, opts);

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

function resolveSnippetsToExport(
  name: string | undefined,
  opts: { type?: string; tag?: string },
): Snippet[] {
  if (name) {
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
    return [result.snippet];
  }

  let snippets = getAllSnippets();

  if (opts.type) {
    snippets = snippets.filter((s) => s.frontmatter.type === opts.type);
  }
  if (opts.tag) {
    snippets = snippets.filter((s) =>
      s.frontmatter.tags.some(
        (t) => t.toLowerCase() === opts.tag!.toLowerCase(),
      ),
    );
  }

  return snippets;
}

// --- Gist export ---

const LANG_TO_EXT: Record<string, string> = {
  javascript: ".js", typescript: ".ts", python: ".py", ruby: ".rb",
  bash: ".sh", zsh: ".sh", fish: ".fish", go: ".go", rust: ".rs",
  java: ".java", kotlin: ".kt", swift: ".swift", c: ".c", cpp: ".cpp",
  csharp: ".cs", php: ".php", perl: ".pl", lua: ".lua", r: ".r",
  sql: ".sql", html: ".html", css: ".css", scss: ".scss", json: ".json",
  yaml: ".yaml", toml: ".toml", xml: ".xml", markdown: ".md", prompt: ".md",
};

function gistFilename(snippet: Snippet): string {
  const ext = LANG_TO_EXT[snippet.frontmatter.language] || ".md";
  return `${snippet.slug}${ext}`;
}

function gistContent(snippet: Snippet): string {
  // Extract code from fenced blocks
  const blocks: string[] = [];
  const regex = /```\w*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(snippet.content)) !== null) {
    blocks.push(match[1].trimEnd());
  }
  return blocks.length > 0 ? blocks.join("\n\n") : snippet.body;
}

async function exportToGist(
  name: string | undefined,
  opts: { type?: string; tag?: string; public?: boolean },
): Promise<void> {
  const snippets = resolveSnippetsToExport(name, opts);
  if (snippets.length === 0) {
    console.error("No snippets to export.");
    process.exit(EXIT_CODES.NOT_FOUND);
  }

  requireGh();

  // If single snippet already has a gist_id, update it
  if (snippets.length === 1 && snippets[0].frontmatter.gist_id) {
    return updateGist(snippets[0]);
  }

  // Create new gist
  const description = snippets.length === 1
    ? snippets[0].frontmatter.title || snippets[0].slug
    : `snip export: ${snippets.length} snippets`;

  const tmpDir = mkdtempSync(resolvePath(tmpdir(), "snip-gist-"));
  const tmpFiles: string[] = [];

  try {
    const args = ["gist", "create", "--desc", description];
    if (opts.public) args.push("--public");

    for (const s of snippets) {
      const tmpPath = resolvePath(tmpDir, gistFilename(s));
      writeFileSync(tmpPath, gistContent(s), "utf-8");
      tmpFiles.push(tmpPath);
      args.push(tmpPath);
    }

    const gistUrl = execFileSync("gh", args, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    console.log(`Created gist: ${gistUrl}`);

    // Save gist_id back to frontmatter for single-snippet exports
    if (snippets.length === 1) {
      const gistId = gistUrl.split("/").pop()!;
      const s = snippets[0];
      writeSnippetFile(s.filePath, { ...s.frontmatter, gist_id: gistId }, s.content);
      console.log(`Saved gist_id to ${s.slug}`);
    }
  } finally {
    for (const f of tmpFiles) { try { unlinkSync(f); } catch {} }
    try { rmdirSync(tmpDir); } catch {}
  }
}

function updateGist(snippet: Snippet): void {
  const gistId = snippet.frontmatter.gist_id;
  const tmpDir = mkdtempSync(resolvePath(tmpdir(), "snip-gist-"));
  const tmpPath = resolvePath(tmpDir, gistFilename(snippet));

  try {
    writeFileSync(tmpPath, gistContent(snippet), "utf-8");
    execFileSync("gh", ["gist", "edit", gistId, "--add", tmpPath], {
      stdio: "pipe",
    });
    console.log(`Updated gist: https://gist.github.com/${gistId}`);
  } finally {
    try { unlinkSync(tmpPath); } catch {}
    try { rmdirSync(tmpDir); } catch {}
  }
}
